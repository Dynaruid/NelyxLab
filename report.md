# Nelyx 구조 및 초기 기술 스택 재검토

작성일: **2026-11-14 KST**

개정: **실제 owner·준비/게시 프로토콜·동기 native 작업·자원 수명 대조 반영**

검토 기준: checkout `d0f6c5f`, `work11.md`, `work11-1.md` 및 아래에 명시한 실제 소스·공식 문서

범위: **Windows Original App의 실제 코드·아키텍처 검토와 의사결정 제안. 보고서만 수정했으며 구현 재개, 런타임 교체, 신규 성능 측정은 하지 않았다.** 공통 TS/Core와 플랫폼별 host의 책임을 구분하며 Windows의 스레드 구성을 Web/Android에 그대로 일반화하지 않는다.

## 1. 판단

**초기 기술 스택과 설계 전제를 다시 검토할 시점이다. 다만 지금의 근거로 프로젝트 전체를 버리고 바닥부터 다시 만들거나, Hermes를 원인으로 확정하는 것은 권하지 않는다.**

현재 가장 직접적인 근거는 **새 내용 생성 시 긴 App 준비 구간과 offset 정체가 남아 있다**는 것이다. 대량 할당·객체 교체가 GC와 네이티브 자원 회수를 유발하고, 그 지연이 coverage 준비 의존을 통해 정체로 나타난다는 설명은 **우선 조사할 가설 중 하나**다. 이전 공급의 기록에는 Source 한 구간의 약 11–13MB 할당과 여러 GC 완료가 있다. 코드에서는 할당 도중의 young GC, 외부 메모리 압력에 따른 수거 조건 변화, finalizer에서 네이티브 버퍼 해제·공용 장부 잠금으로 이어지는 경로를 확인했다. 다만 경로의 존재는 실제 비용의 크기나 최신 정체의 원인을 입증하지 않는다. **구조 문제와 GC 문제는 별개의 경쟁 설명이 아니다.**

실제 offset 정체 중 GC 정지·잠금 대기·일반 Source 실행·Content 준비가 각각 차지한 시간은 아직 분리되지 않았다. 특히 **App은 동기 JSI 호출로 C++ 문단 작업도 실행하며, C++ Core는 독립된 다섯 번째 스레드가 아니라 여러 owner가 공유 잠금으로 접근하는 상태·알고리즘**이다. 따라서 Source elapsed를 순수 JS 시간으로 읽거나, owner가 분리됐다는 이유로 Core 경합을 제외해서는 안 된다. 최신 §13.31 공급에서는 힙을 재관측하지 않았다. Native AOT도 같은 Hermes 객체·GC 체계를 사용하므로, AOT에서도 실패했다는 사실은 GC 가설의 반증이 아니다.

따라서 권고는 다음과 같다.

1. **긴 App 준비와 coverage 대기의 연결을 먼저 확인한다.** Source/capture의 JS 실행·할당, App의 동기 native 호출, GC·회수, mailbox·Core 잠금 대기, Content 준비와 게시 의존을 같은 시간축에서 나눈다. 임시 객체·snapshot·외부 응답 버퍼의 수명과 수거 경계의 잠금도 포함한다.
2. **확인된 비용 경로를 바꾸는 작은 수정부터 선택한다.** 반복 표현 제거, 불필요한 참조 보유 해소, 안전한 자원 회수 분리가 후보이며 실제 병목 입증 전 적용을 확정하지 않는다. GC 수정 자체를 다음 단계의 필수 조건으로 삼거나 helper 몇 개의 제거량만으로 전체 GC 부담이 해결됐다고 판단하지 않는다.
3. **TypeScript UI SDK가 목적이고 원인 분해 결과 Source 작업량이 핵심으로 남는다면 UI 생성·소유 모델을 부분 재설계한다.** 이미 존재하는 native layout·control·재사용 경로를 출발점으로, 그 앞에서 실제로 없어지는 Source 작업을 특정한다. 공개 의미 보존과 비공개 객체의 동일한 생성 방식을 보존하는 것은 구분한다.
4. **앱 제품 완성이 목적이고 TypeScript가 필수가 아니라면 원본 Flutter/Dart를 우선 평가한다.** 필수 기능·플랫폼과 이전 비용을 확인해야 하며 현재 앱보다 빠르다고 검증된 대안은 아니다. Flutter도 GC를 사용하므로 GC를 없애기 위한 전환으로 설명하지 않는다.
5. **V8는 필요할 때 원인을 나누는 비교 수단이다.** 실행 방식뿐 아니라 GC·allocator·외부 자원 처리도 바뀌므로, V8가 빨라져도 곧바로 JIT 단독 효과로 해석하지 않는다. Windows JIT 결과는 일반 iOS 배포 전략과도 구분한다.

“iOS 때문에 AOT 또는 인터프리터가 필요했다”는 판단은 일반 앱을 대상으로 할 때 타당하다. **“그러므로 Hermes를 계속 사용해야 한다”는 결론은 필수가 아니다.** 선택해야 할 것은 VM 이름보다 먼저, 어떤 UI 작업을 어떤 언어와 실행 모델에 맡길 것인가다.

## 2. 이번 검토에서 확인한 것과 확인하지 않은 것

### 2.1 기록의 현재성

판단 기준은 현재 저장소 문서와 코드다. `work11-1.md`의 최신 정지 지점은 **§13.33**이며, 실제 기준 공급 기록은 **§13.31**이다. 작업은 `PAUSED / PARTIAL`, 성능은 미수락 상태다.

직전 검토 기준 `97d45c8`과 현재 `d0f6c5f` 사이에는 실행 코드 변경이 없다. 이번 개정은 아래 함수들의 호출·소유권 경계를 추가로 추적한 정적 검토이며, 실행 중 비용 순위를 새로 측정한 결과가 아니다.

현재 [engine manifest](Nelyx/engine/dist/engine-manifest.json)의 `sourceSha256`은 `7fde85bf683331939cbefdd47c0a1fb417805db05f37a3f1dec29e15c56ebf1a`로 §13.31 기록과 일치한다. `qualification`은 `host-integration-candidate`다. 이것은 manifest를 읽은 결과이며 이번에 전체 바이너리 무결성이나 실행 결과를 재검증하거나 제품 수락 상태를 바꾼 것은 아니다.

이하 수치는 모두 **기존 작업 기록의 측정값**이다. 시나리오·공급·입력 속도가 다른 값을 한 성능 개선 추세로 연결하지 않았다. 함수 elapsed, 비동기 대기, GC 통계, 게시 시각과 물리 표시를 구분했다.

### 2.2 결정에 중요한 기존 증거

| 근거 | 기록된 결과 | 이번 판단에 주는 의미 |
| --- | --- | --- |
| [work11-1 §12.3](work11-1.md#123-source와-projection의-같은-공급-비교), field/helper × direct/reference 4조합 | 네 조합 모두 기능 PASS, 성능 FAIL. 각 1회 대조 | 직접 투영이나 field 보존만으로 해결됐다고 할 수 없다. 일부 순위도 일관되지 않는다. |
| [work11-1 §12.7](work11-1.md#127-실제-트랙패드-확인과-최종-경계), 사용자 물리 확인 | 빠른 스크롤에서 “멈춤 점프있음”. App turn p95/최대 269.683/352.259ms | 자동 검사에만 존재하는 문제가 아니다. 다만 최신 §13.31의 물리 재측정은 아니다. |
| [work11-1 §13.17](work11-1.md#1317-같은-source의-실제-native-unitbytecode-대조--기능-pass--성능-fail), 같은 App/engine의 native↔HBC | 이동 p95 237.218↔379.392ms. 양쪽 성능 FAIL | 실행 모드가 영향을 줄 가능성은 있다. native AOT가 구조적 대기를 없애지는 못했다. 단일 대조로 보편적 개선율을 확정할 수 없다. |
| 같은 §13.17, 준비된 구간의 네 접촉 | 최대 입력→게시 지연 26.521/13.338/12.034/15.408ms | 준비된 내용의 이동과 새 내용 생산을 구분해야 한다. 전체 렌더 경로가 항상 느리다는 설명은 불충분하다. |
| [work11-1 §13.27](work11-1.md#1327-기존-source-시각과-같은-app-owner의-힙-관측-연결--진단-pass--일반-성능-fail), 이전 공급의 별도 profiling | 한 build 119.873ms / 12,511,600 bytes / GC 완료 4회. runtime 누적 GC 시간 556.026ms, 최대 단일 13.948ms | 대량 할당과 GC가 함께 발생한다는 근거. build 내부 GC 정지 시간이나 최신 공급의 GC 비율은 아니다. |
| [work11-1 §13.30](work11-1.md#1330-fitted-grid의-소유-숫자-식-공유--반복-할당-감소-확인--전체-성능-fail) | 42셀 숫자 graph 소유 객체 1,175→241. 전체 성능 FAIL | 실제 중복 제거는 있었다. 특정 내부 graph의 감소를 화면 전체 생성비용 감소로 확대할 수 없다. |
| [work11-1 §13.31](work11-1.md#1331-public-staticinstance-private-field의-native-저장소-후보--통합-기능-pass-calendarfast-성능-fail), 최신 Calendar 3배속 | 이동 p95/최대 200.279/241.915ms, offset 정체 최대 234ms, ≥100ms 11회 | 현재 해결되지 않은 핵심 현상이다. 입력 누락 없이 최종 월에 도착한 사실로 성공 처리할 수 없다. |
| 같은 §13.31 | publication gap 최대 26.819ms, App turn p95/최대 145.279/165.368ms | 게시가 계속되더라도 offset이 정체할 수 있다. FPS만으로는 이 실패를 판정할 수 없다. |
| [work11-1 §13.33](work11-1.md#1333-v8-jit-직접-host-진단과-사용자-요청에-따른-정지--paused--partial) | V8 진단 host 빌드·모듈 초기화는 PASS, GUI는 app-ready 전 실패 | **사용 가능한 V8 Demo와 스크롤 성능 비교는 아직 없다.** |

§13.31의 한 cold pass는 App capture의 created/captured **784/827**, App 투영의 `paragraphPreparations` **76**, build/capture/scene **78.705/43.249/53.054ms**, wait **19.752ms**다. [capture.ts](Nelyx/runtime/app/capture.ts)의 created/captured는 capture entry 생성·투영 횟수이며 Widget 전체 수나 Core nodeCount가 아니다. [host.ts](Nelyx/runtime/app/host.ts)의 `paragraphPreparations`도 prepared paragraph 옵션의 투영 카운터이지 Content의 SkParagraph layout 실행 횟수가 아니다. build와 capture는 60Hz 한 프레임의 16.67ms보다 각각 길지만, scene에는 비동기 처리가 있으므로 이 숫자를 전부 더해 “CPU가 그만큼 막혔다”거나 “234ms 정체를 전부 설명했다”고 말하면 안 된다.

또한 180Hz는 이 검사의 **입력 표본 속도**다. 180fps 렌더링을 요구한 검사가 아니다. 12개월을 약 2초에 이동하면 평균 새 월 간격은 약 166.7ms이지만, 실제 준비 단위·기존 상주 범위·동시 작업이 있으므로 이것만으로 정확한 월 생산 처리량을 계산할 수는 없다.

**최신 공급과 힙 관측의 경계:** §13.31은 native field 변경 후의 Calendar/Fast 기록이며, 변경 후 힙 재관측은 하지 않았다. §13.27–§13.30의 할당량·GC 통계를 최신 공급의 값으로 옮겨 쓰거나, 서로 다른 실행의 GC 최대값과 234ms 정체를 직접 연결할 수 없다. 현재 확인된 것은 이전 진단 구간의 대량 할당·GC 완료, 최신 일반 실행의 긴 App 구간·정체, 그리고 이를 연결할 수 있는 코드 경로다. 이 세 가지 사이의 시간 인과는 미검증이다.

## 3. 코드로 확인한 실행 구조와 병목 후보

### 3.1 현재 경로는 이미 C++ 엔진과 여러 owner로 분리되어 있다

현재 Windows Original App의 일반적인 layout 변경 경로는 다음과 같다. **Core는 별도 스레드 이름이 아니다.** Core 함수는 호출한 owner에서 실행되며 공유 상태의 잠금 경계는 §3.8과 같다.

```text
UI owner: native 입력 → Core input queue → Render tick의 입력 처리
App owner: TS Widget·Element·State / RenderObject
           + 동기 JSI native 문단 호출
           → capture / RenderBinding / SceneWriter → transaction mailbox
Content owner: Core transaction 수락 → Core contentStep / layout
               ↔ App의 layoutBuildRequest 응답 / 새 transaction
               ↔ ContentProvider.measure / measureResult
               → ready snapshot → ContentProvider.prepare → candidate
Render owner: providerReady → Core tick / activate → takeFrame
              → Graphite/Vulkan draw·submit/present
              → GPU 완료 관측 → releaseFrame / publish
App 관찰: live state·layout 요청과 published geometry·semantics를 구분
```

[Windows host](Nelyx/engine/platform/windows/host.cpp)의 `contentLoop`·`renderLoop`·`appLoop`와 UI 메시지 처리가 이 owner 구분을 구현한다. 준비된 scrollViewport의 허용된 native 입력 경로는 매 프레임 Source rebuild를 기다리지 않고 이동할 수 있다. 반대로 [gestures.cpp](Nelyx/engine/core/interaction/gestures.cpp)의 `appDecision`처럼 App 승인을 기다리는 분기도 있다. “모든 UI 작업이 JS 한 스레드에 있다”와 “native 입력은 항상 App과 독립적이다”는 설명이 모두 부정확하다.

또한 [capture.ts](Nelyx/runtime/app/capture.ts)의 dirty/field 정보와 subtree 재사용, [host.ts](Nelyx/runtime/app/host.ts)의 1063–1079행에 있는 직접 command capture가 이미 존재한다. 다시 “retained로 바꾸자”, “중간 트리를 없애자”라고만 제안하면 기존 시도를 반복하게 된다.

native Render도 프레임마다 JS를 거치는 구조가 아니다. [host.cpp](Nelyx/engine/platform/windows/host.cpp)의 `dispatchNativeFrame` 호출은 [engine.cpp](Nelyx/engine/core/protocol/engine.cpp)에서 paint node-row 직렬화를 생략하고 C++ `Frame` reader를 전달한다. 다만 `copyNativeFrame`은 vector 저장소를 복사하므로 전체 경로가 zero-copy라는 뜻은 아니다. [Document](Nelyx/engine/core/scene/document.hpp)와 [PagedStorage](Nelyx/engine/core/scene/paged_storage.hpp)도 snapshot 사이에 페이지·불변 노드를 공유하며 [transact](Nelyx/engine/core/protocol/transaction.cpp)는 수정 노드를 복제한다. snapshot 개수에 전체 트리 크기를 곱해 복사량을 추정해서는 안 된다.

검토할 것은 **재사용 가능한 기존 노드의 갱신 이후에도 남는 새 내용 생성비용과, 이 단계들 사이의 필수 왕복**이다. 복수 트리 자체가 잘못이라는 뜻은 아니다. Flutter와 React Native도 목적이 다른 표현을 여러 개 유지한다. 각 표현의 작업량·갱신 범위·연결 비용이 문제다. [Flutter 구조](https://docs.flutter.dev/resources/architectural-overview), [React Native 렌더 파이프라인](https://reactnative.dev/architecture/render-pipeline).

### 3.2 async 함수 안에서도 실제 Source 생성은 긴 동기 작업이다

현재 코드에서 확인되는 순서는 다음과 같다.

| 위치 | 실제 동작 | 의미 |
| --- | --- | --- |
| [host.ts](Nelyx/runtime/app/host.ts), 1493–1511행 | `Promise.then(() => perform())`으로 flush 실행 | Promise를 썼다는 사실이 내부 작업의 분할을 뜻하지 않는다. |
| 같은 파일, 1653–1750행 | `flushBuild`, `syncRenderTree`, retained builder rebuild, 다시 flush, scene capture | 한 JS owner에서 연속 실행되는 동기 구간이 있다. |
| [framework.ts](Nelyx/src/framework/widgets/framework.ts), 811–869행 | dirty Element rebuild와 render tree commit | dirty queue를 이미 사용하지만, 선택된 자손의 실제 생성·상태 처리는 남는다. |
| [text.ts](Nelyx/runtime/app/text.ts)의 `AppTextLayoutService.layout` → [app_text_jsi.hpp](Nelyx/engine/platform/common/app_text_jsi.hpp) → [AppParagraphs::layout](Nelyx/engine/platform/common/app_text.hpp) | 같은 App 스레드에서 C++ paragraph build·geometry 변환을 동기 실행 | C++으로 구현됐다는 사실이 App owner의 점유 시간을 없애지 않는다. |
| [capture.ts](Nelyx/runtime/app/capture.ts), 109–120행 | Source build가 동기적으로 끝난 뒤 capture한다는 계약 | 중간에 임의 yield를 넣으면 invalidation·callback·snapshot 경계를 함께 재설계해야 한다. |
| [host.cpp](Nelyx/engine/platform/windows/host.cpp), 570–604행 | App 작업과 Promise continuation을 `drainMicrotasks()`로 실행 | 마이크로태스크 내부의 긴 build를 스케줄러 옵션만으로 짧게 만들 수 없다. |

따라서 타이머, Promise, 작업 우선순위만 바꾸는 것으로 실제 계산량이 줄지는 않는다. 임의 JS callback의 중간 상태를 안전하게 외부에 노출하거나 취소·재실행할 수 있다고 가정해서도 안 된다.

**App의 동기 문단 API와 Content의 문단 측정은 별도 경로다.** 전자는 Source의 동기 layout/query 의미를 제공하고, 후자는 Core layout의 측정 요청을 Content provider가 처리한다. 따라서 build/Source elapsed에는 JS뿐 아니라 그 안에서 호출한 native 작업·GC·대기가 포함될 수 있다. VM 교체나 Typed Hermes만으로 이미 C++인 문단 작업까지 없어지는 것은 아니며, 두 경로가 같은 문단을 항상 중복 처리한다고 단정해서도 안 된다.

### 3.3 준비되지 않은 영역에서는 Core가 실제 이동을 제한한다

[scheduler.cpp](Nelyx/engine/core/scheduler/scheduler.cpp)의 `View::applyDelta` 760–783행은 입력으로 계산한 위치를 `coverage.minimum/maximum`으로 제한하고, 부족하면 `needContent`를 요청한다. `advanceDeferred` 815–820행도 준비된 범위 안으로 목표를 제한하며, page 경로는 가능한 위치로 직접 따라간다.

이 코드는 다음 현상을 설명할 수 있다.

1. 입력의 논리적 목표 위치는 앞으로 진행한다.
2. 새 월의 표시 가능한 내용이 아직 없다.
3. 렌더 스레드는 계속 프레임을 게시하지만 offset은 준비 경계에 머문다.
4. 준비가 완료되면 뒤에 쌓인 목표를 따라 이동해 점프처럼 보일 수 있다.

이는 **소스로 확인한 동작과 기존 관찰에 부합하는 원인 가설**이다. 최신 실행의 demand 생성→Source→Content ready→activation→offset 전체 인과는 아직 완성되지 않아, 모든 정체를 이 경로 하나로 확정할 수는 없다.

coverage 검사를 제거하는 것은 해법이 아니다. 준비되지 않은 픽셀·hit test·semantics를 노출하게 된다. 기존 의미를 유지하려면 제시간에 준비하거나, 제품 계약에서 미준비 영역을 어떻게 표시할지 명시해야 한다.

다만 **coverage 부족의 `needChildren` 이벤트와 Content layout의 `layoutBuildRequest`는 같은 요청이 아니다.** [SceneWriter.pollEvents](Nelyx/runtime/engine-client/scene.ts)는 전자를 layout 관찰 demand로 유지한다. [LayoutWork](Nelyx/engine/core/layout/layout.cpp)는 builder revision·실제 constraints 또는 list 범위가 맞지 않을 때 별도의 pending build를 만들고, [OriginalWidgetHost.rebuildFromContent](Nelyx/runtime/app/host.ts)는 그 node·document·metrics·device·revision을 확인해 Source를 실행한다. 응답 transaction이 맞으면 기존 preparation을 resume할 수도 있다. 한 번의 정체를 한 번의 builder 왕복으로 환산하면 안 된다.

또한 [grid.ts](Nelyx/runtime/app/grid.ts)의 fitted-grid 경로는 이미 Content의 실제 제약을 사용하는 두 native layout program으로 셀을 배치한다. 이 경로에는 provisional Grid LayoutBuilder 응답이 없으며, 그렇다고 날짜별 Source child 생성까지 없어진 것은 아니다. “달력 배치를 C++로 옮기자”만으로 새 수정의 차이를 설명할 수 없다. Core overlay의 `offset` 변경과 published Frame의 offset도 서로 다른 시점이다.

### 3.4 기존 게시를 기다리는 장벽도 있다

현재 Windows provider 연결 경로에서 구분해야 할 단계는 다음과 같다. 근거는 [engine.cpp](Nelyx/engine/core/protocol/engine.cpp), [scheduler.cpp](Nelyx/engine/core/scheduler/scheduler.cpp), [host.cpp](Nelyx/engine/platform/windows/host.cpp)다.

| 단계 | 실제 의미 | 아직 보장하지 않는 것 |
| --- | --- | --- |
| transaction accepted / ACK | Core가 새 document를 수락했고 App이 결과를 알게 됨 | layout·native 준비·화면 게시 완료 |
| `Preparation.ready` | Core의 layout/geometry 준비 완료 | Content의 그림 기록·GPU 완료 |
| `Preparation.providerReady` | Content의 prepared candidate를 Render가 같은 cohort로 수락 | 활성화·프레임 게시 완료 |
| `View.active` | tick의 activate가 새 scene을 설치 | 그 scene의 프레임이 이미 게시됐다는 보장 |
| `View.published` / publication | host가 GPU 완료를 관측하고 releaseFrame/publish한 snapshot | 물리 scanout·사용자가 본 시각 |

Render는 이전 GPU slot이 차 있어도 tick/activation을 진행한다. 반면 새 draw는 slot이 비어야 한다. 따라서 준비·활성화·GPU 제출·publication을 한 단계나 하나의 ACK로 합쳐서는 안 된다. 일부 retained paint 갱신은 전체 Content 준비를 건너뛰는 별도 경로도 있다.

[host.ts](Nelyx/runtime/app/host.ts)의 `waitForContent`는 동일 metrics/device/font cohort에서 accepted document가 아직 게시되지 않았고 준비 또는 활성화된 작업이 남은 경우 후속 일반 invalidation을 기다린다. 그러나 해당 document의 유효한 layout build request는 예외이며, `perform`은 대기 전과 대기 루프에서 `rebuildFromContent`를 먼저 실행한다. 필요한 Source 응답까지 게시 뒤로 미루는 무조건 장벽이 아니다. 연속 invalidation으로 준비가 계속 교체되어 publication이 굶는 것을 막는 이유도 코드에 명시되어 있다.

이 장벽에는 정확성상의 이유가 있다. 그냥 없애면 같은 문제가 재발할 수 있다. 그러나 비싼 Source 생성, Content 준비, document 단위 게시가 연결될수록 다음 요구가 기다릴 가능성도 커진다. 재설계에서는 **어떤 변경이 이전 게시와 정말 직렬이어야 하는지, 독립된 새 subtree 준비를 먼저 진행할 수 있는지**를 따져야 한다.

현재도 일부 builder 요청과 관찰 lane은 분리되어 있으므로 “지금은 모든 요청이 무조건 직렬이다”라는 단정은 하지 않는다.

### 3.5 원본 동작 보존의 비용이 계속 발생한다

[변환된 calendar source](packages/material/src/generated/date/calendar_date_picker.generated.ts)는 실제 `_DayPickerState`, 날짜별 FocusNode, Ink·Semantics 구성과 Dart 의미 helper를 사용한다. 예를 들어 1127–1139행은 `late` field 접근을 별도 helper로 처리하고, 1842행 이후에는 날짜 FocusNode를 생성한다.

이것은 단순한 달력 데이터 42개를 그리는 경로보다 많은 일을 한다. 동시에 해당 객체에는 키보드 이동, 상태 수명, 테마 의존성, 입력과 접근성이라는 실제 목적이 있다. 소스만 보고 전부 불필요하다고 제거할 수는 없다.

구분할 것은 **관찰 가능한 Source 의미를 보존하는 것**과 **비공개 중간 객체를 원본과 똑같이 생성하는 것**이다. W11의 실제 제약은 사용자 callback·override·State/Key 수명·동기 관찰 등의 보존이며, 모든 내부 할당이나 호출 형태를 그대로 유지한다는 정책은 아니다. 이미 적용한 private helper 제거·숫자 graph 공유·native field 보존이 그 차이를 보여 준다. 현재 비용만으로 호환성 정책을 완화해야 한다고 확정할 수는 없다.

Flutter는 Dart 프레임워크와 엔진이 함께 설계된 경로를 제공한다. Nelyx는 변환된 언어 의미, TS 프레임워크, native projection, 자체 Core를 함께 유지한다. 이 추가 경계가 개발·성능 비용을 만든다는 판단은 가능하지만, “Flutter는 트리가 하나라 빠르다” 또는 “Dart AOT는 GC가 없다”는 설명은 틀리다. [Flutter 구조](https://docs.flutter.dev/resources/architectural-overview), [Flutter의 Dart 선택 이유와 GC](https://docs.flutter.dev/resources/faq#why-did-flutter-choose-to-use-dart).

### 3.6 현재 근거로 주원인이라고 단정하면 안 되는 것

| 후보 | 현재 판단 |
| --- | --- |
| Hermes 자체 결함 | 미확정. native/HBC 차이는 있지만 대체 VM의 유효한 앱 성능 비교가 없다. |
| GC 및 메모리 회수 | **우선 조사 후보 중 하나.** 이전 진단의 대량 할당·GC 완료와 수거/해제 경로는 확인했다. 최신 공급의 할당량, 전체 정체에서의 기여 시간, 설정 오류 여부는 미확정이다. 단일 pause 최대값만으로 배제하지 않되, 다른 후보보다 큰 원인이라고 확정하지 않는다. |
| 접근성 브리지 전체 | W11에서 App/Core/UIA 비용을 분리했고 해당 관찰에서 Source보다 작았다. Source의 Semantics 생성 비용은 별도다. 접근성을 꺼서 해결할 근거는 부족하다. |
| JSI라는 인터페이스 자체 | JSI 교체는 JS 객체 생성·reconcile 작업을 자동으로 없애지 않는다. 같은 App 스레드의 동기 native 호출과 mailbox를 거치는 비동기 packet 왕복, Render의 C++ Frame 전달을 구분해야 한다. |
| GPU/Skia가 유일한 원인 | 최신 Calendar의 작은 publication gap과 큰 offset 정체를 함께 설명하지 못한다. 반대로 이전 물리 실행에는 긴 publication gap도 있어 GPU·host 문제가 전혀 없다고 결론 내릴 수도 없다. |
| 진단 계측만의 착시 | 일반 실행과 사용자 물리 실패가 있다. 다만 계측 elapsed를 CPU self time으로 읽으면 안 된다. |

### 3.7 GC·대량 할당/해제에 대한 추가 코드 검토

#### 3.7.1 기존 힙 관측은 GC 가설을 우선 조사할 근거다

| 기록 | 관측 범위와 수치 | 해석의 한계 |
| --- | --- | --- |
| work11-1 §13.27, input 233/pass 55 | build 119.873ms / 12,511,600 bytes / GC 완료 4회. 내부 Source 115.117ms / 11,898,800 bytes / 4회 | 내부 Source는 build와 중첩되므로 합산하지 않는다. GC 완료 수는 정지 구간 수가 아니다. |
| §13.28, input 44/pass 47 및 input 159/pass 51 | Source 80.026ms / 12,223,848 bytes / 3회, 83.263ms / 12,168,216 bytes / 3회 | 다른 공급·구간이므로 이전 수치와 단순 개선율 비교를 하지 않는다. |
| §13.30, fitted grid 중복 감소 후 | 큰 Source 세 구간에 76–86ms / 약 11.4–11.7MB가 남음 | 특정 graph를 줄여도 전체 생성비용이 작아졌다고 할 수 없다. |
| §13.27 / §13.29 / §13.30의 runtime 누적 통계 | GC 시간 556.026 / 605.105 / 565.883ms, 최대 단일 13.948 / 16.544 / 14.925ms | 각각 runtime 시작부터의 서로 다른 실행이다. 2초대 활성 profile 시간으로 나눠 GC 점유율을 계산하면 안 된다. |

이 수치는 누적 allocation counter의 차이이며 현재 살아 있는 메모리, 누수량, 해제한 bytes가 아니다. 새 월 하나의 정확한 전체 할당량도 아직 아니다. 그럼에도 짧은 Source 구간에서 반복적으로 큰 할당량이 발생한다는 점은 확인되어 있다.

조사할 가설은 **생성·갱신 중 할당 집중 → 수거·생존 객체 처리·일부 외부 자원 회수 → 새 내용 준비 지연 → coverage 경계에서 offset 정체 → 준비 후 목표 위치 추종**이다. 할당 slow path의 수거·finalizer와 coverage 제한이라는 개별 메커니즘은 코드로 확인했다. 그러나 실제 실패 구간에서 이들이 위 순서로 이어졌는지, 일반 객체 생성·Source 실행보다 얼마나 큰 비용인지는 미확정이다.

#### 3.7.2 현재 빌드 설정의 GC는 Hades이며, 동시 실행이 모든 정지를 없애지는 않는다

로컬 [CMakeCache](.nelyx/windows-hermes/build/CMakeCache.txt) 322·349행은 `HERMESVM_ALLOW_CONCURRENT_GC=ON`, `HERMESVM_GCKIND=HADES`다. 이것은 현재 빌드 설정 확인이며 이번에 실행 중 VM의 속성을 다시 읽은 것은 아니다.

[host.cpp](Nelyx/engine/platform/windows/host.cpp) 501행의 `GCConfig` 지정은 profiling 통계 여부뿐이다. 현재 host 코드에는 화면 deadline에 맞춰 young GC를 예약하는 별도 정책이 없다. 고정 소스의 [GCConfig.h](.nelyx/windows-hermes/source/public/hermes/Public/GCConfig.h) 기본값은 초기 heap hint 32MiB, 최대 hint 3GiB, occupancy target 0.5, young 할당 활성화다. 이 숫자는 고정 nursery 크기·실제 상주 메모리·제품 메모리 예산과 같지 않다.

[HadesGC.cpp](.nelyx/windows-hermes/source/lib/VM/gcs/HadesGC.cpp)의 다음 경로가 중요하다.

- **2301–2326행:** 일반 young 할당이 실패하는 slow path에서 `youngGenCollection`을 실행한다. 입력이 진행 중이거나 Source build 중이어도 필요하면 발생한다.
- **2644–2837행:** young 수거에서 살아남은 객체 처리, finalizer, 일부 old generation 관련 작업을 수행하고 mutator 통계를 기록한다. mutator는 여기서 JS를 실행하는 App 스레드다.
- **1484–1511행:** 진행 중 수거를 직접 완료시키는 `waiting` 경로도 존재한다. 경로가 있다는 것과 실제 Calendar에서 호출됐다는 것은 다르다.
- **3349–3380행:** 동시 GC에서도 `CompleteMarking` 처리 경계가 있다. 모든 old generation 작업이 App 스레드와 무관하다고 가정하지 않는다.

Hades가 주로 old generation 작업을 배경에서 수행하면서도 young 수거와 다른 비용을 남긴다는 원리는 [공식 설명](https://reactnative.dev/blog/2021/10/26/toward-hermes-being-the-default)과도 일치한다. 그 글의 과거 benchmark를 현재 Nelyx의 pause 예측값으로 사용하지 않았다.

#### 3.7.3 “GC 스케줄 문제”는 세 가지로 나눠야 한다

| 구분 | 현재 코드 근거 | 판단 |
| --- | --- | --- |
| 수거를 시작하는 조건 | young 공간 소진, old generation 사용량, 외부 메모리 pressure | 실제 화면 작업 도중에 수거가 들어갈 수 있다. idle 예약 문제로만 설명할 수 없다. |
| 한 번에 처리하는 양·크기 조절 | `kTargetMaxPauseMs=50`, young 크기 조절의 10/20ms 임계값 | 프레임 예산과 독립적인 휴리스틱이다. 실제 50ms pause, 50ms 주기, 50ms 상한 보장을 뜻하지 않는다. |
| 스레드·잠금 대기 | GC background와 App의 `gcMutex_`, 자원 회수의 `Ledger::gate` | GC 자체 계산 외의 대기 가능성이 있다. 실제 대기 시간은 미측정이다. |

`updateYoungGenSizeFactor` 2918–2930행은 수거가 10ms 미만이면 크기 비율을 10% 늘리고, 20ms 초과이면 10% 줄인다. 10–20ms 구간은 이 조건으로 축소하지 않는다. 따라서 14–17ms 수준의 pause가 관측됐다는 사실만으로 “GC가 이미 UI에 충분히 짧게 조정된다”고 판단할 수 없다.

반면 `yieldToOldGen`의 **25ms incremental budget은 `!kConcurrentGC` 분기**다. 이 상수를 현재 Windows 동시 GC에서 매번 실행되는 작업량으로 인용하면 잘못이다. `50`을 작게 바꾸는 패치는 빈도 증가·처리량 저하·생존 객체 처리 비용과 함께 검토해야 하며, 단일 상수 변경을 해법으로 확정하지 않는다.

#### 3.7.4 중요한 관측 공백: GC 통계 시작 전에 기다릴 수 있다

`allocSlow` 2317행은 `ensureBackgroundTaskPaused()`로 먼저 잠금을 얻은 뒤 young 수거에 들어간다. [HadesGC.h](.nelyx/windows-hermes/source/include/hermes/VM/HadesGC.h) 1398–1402행과 `HadesGC.cpp` 1652–1664행을 따라가면 background pause 요청 후 **`gcMutex_.lock()`을 기다리는 경로**다.

반면 young 수거의 `CollectionStats::setBeginTime()`은 `youngGenCollection` 내부 **2655행**이다. 따라서 이 호출 경로의 **수거 진입 전 잠금 대기는 해당 young event의 duration에 포함되지 않는다.** 현재 구현은 mutator가 잠금을 우선 얻도록 설계되어 있지만, 실제 대기 시간이 충분히 짧은지는 기존 기록만으로 알 수 없다.

이 때문에 “최대 GC pause가 약 15ms였으므로 GC 관련 지연도 최대 15ms”라는 추론은 성립하지 않는다. 동시에 이 코드만으로 큰 잠금 대기가 실제 발생했다고 주장해서도 안 된다. 이는 측정 범위의 공백을 확인한 결과다.

#### 3.7.5 응답 버퍼는 수거 시점과 네이티브 해제를 연결한다

현재 [host.cpp](Nelyx/engine/platform/windows/host.cpp) 54–65행, 591–594행은 Core의 응답을 `ResponseBuffer`로 옮겨 JS `ArrayBuffer`에 연결하고 `setExternalMemoryPressure(size)`를 호출한다. 이 경로는 단순한 JS wrapper 생성 이상의 수명을 갖는다.

이 전송은 양방향 zero-copy가 아니다. App→Core의 `enqueue`는 JS ArrayBuffer를 native vector로 복사하고, Core→App 응답은 vector를 move한 외부 backing을 연결한다. Render의 C++ Frame 전달은 이 App packet 전송과 별도 경로다.

```text
Core 응답 vector + ExternalLease
  → shared_ptr<ResponseBuffer>를 가진 외부 ArrayBuffer ← DataView / lazy row
      ├ backing NativeState finalizer → shared_ptr 해제
      │   → 마지막 소유자라면 ResponseBuffer 파괴
      │   → ExternalLease 반환(Ledger 잠금) → vector 저장소 해제
      └ pressure NativeState finalizer → Hermes external pressure 차감
```

근거는 다음과 같다.

| 코드 | 확인한 사실 |
| --- | --- |
| [hermes.cpp](.nelyx/windows-hermes/source/API/hermes/hermes.cpp), 2970–2984행 | `MutableBuffer`의 shared pointer를 `JSArrayBuffer::setExternalDataBlock`에 넘긴다. |
| [JSArrayBuffer.cpp](.nelyx/windows-hermes/source/lib/VM/JSArrayBuffer.cpp), 287–309행 | 외부 backing을 가진 `shared_ptr`를 NativeState에 보관하고 finalizer에서 직접 delete한다. |
| [NativeState.cpp](.nelyx/windows-hermes/source/lib/VM/NativeState.cpp), 35–37행 | 등록된 finalizer 함수를 호출한다. |
| [memory.hpp](Nelyx/engine/core/memory.hpp)의 `ExternalLease`·`Ledger::adjust` | lease 반환은 공용 mutex 안에서 회계 값을 갱신한다. 응답 vector의 실제 저장소 해제와는 별도다. |
| [hermes.cpp](.nelyx/windows-hermes/source/API/hermes/hermes.cpp), 2626–2698행 | fresh 객체의 external pressure에는 별도 NativeState를 만들고, 수거 시 pressure를 debit한다. |
| `HadesGC.cpp`, 2019–2031행 | young 소유 외부 bytes는 유효 할당 끝을 당기며, old 사용량이 목표를 넘으면 다음 young 할당에도 영향을 준다. |

따라서 **외부 응답량·보유 시간은 다음 GC 발생 조건에 영향을 주고, 실제 수거는 네이티브 해제 작업을 동반할 수 있다.** 일부 JSI HostObject/NativeState에 별도 finalizer executor가 있다는 사실을 이 외부 backing 경로에 그대로 적용하면 안 된다. 이번에 추적한 `setExternalDataBlock`의 finalizer는 그 executor로 위임하지 않는다. 수거되는 세대·단계에 따라 App 또는 GC 작업 스레드에서 실행될 수 있다.

두 NativeState의 finalizer는 별도이므로 pressure 차감과 backing 파괴가 같은 순서·시각에 일어난다고 가정하지 않는다. [AppHeapAccount::update](Nelyx/engine/platform/windows/host.cpp)는 ledger와 VM pressure의 중복을 제외하되 counter가 어긋나면 보수적으로 계상한다. 또한 `ResponseBuffer` 멤버 파괴 순서상 lease 반환의 `Ledger::gate`는 vector 저장소 해제 전에 풀린다. `Ledger::adjust`의 잠금 안에서 큰 vector free나 GPU 대기를 수행하는 코드는 아니므로, mutex가 있다는 사실만으로 긴 경합을 설명해서는 안 된다.

이것은 잠금 경합·큰 free 비용의 **가능 경로를 확인한 것**이며, response finalizer가 현재 정체의 주범이거나 deadlock이 있다는 증명은 아니다. pressure 누적 오류나 누수도 확인되지 않았다. pressure를 지우거나 accounting을 생략하면 원인을 숨기므로 해법으로 삼지 않는다.

#### 3.7.6 “많이 버린다”와 “그 자리에서 많이 해제한다”를 구분한다

[capture.ts](Nelyx/runtime/app/capture.ts) 275–292행과 [scene.ts](Nelyx/runtime/engine-client/scene.ts) 2730–2805행은 retirement에서 여러 참조·등록을 해제한다. 이 동기 작업 자체의 비용과, 도달 불가능해진 JS 객체를 나중에 GC가 수거하는 비용은 다르다. 보존 중인 State·이전 snapshot·미완료 transaction이 있으면 다른 참조가 남아 있을 수도 있다.

[client.ts](Nelyx/runtime/engine-client/client.ts) 312–319행은 owned observation을 전달하고, [codec.ts](Nelyx/runtime/engine-client/codec.ts) 1578–1587행은 그 buffer를 사용하는 lazy row를 만들 수 있다. row가 살아 있으면 backing도 필요하다. 현재 [observation-stream.ts](Nelyx/runtime/engine-client/observation-stream.ts)와 [observation-row.ts](Nelyx/runtime/engine-client/observation-row.ts)에는 소수의 row가 큰 packet을 계속 붙잡지 않도록 compaction이 이미 있다. 이를 누락된 기능으로 다시 제안하지 않는다.

**모든 native 자원이 응답 ArrayBuffer의 GC 수명으로 관리되는 것은 아니다.** [AppTextLayoutService](Nelyx/runtime/app/text.ts)의 resource 반환은 backend `release`를 호출하고, [AppParagraphs](Nelyx/engine/platform/common/app_text.hpp)는 handle별 entry를 명시적으로 제거한다. Core Document/Node는 C++ shared ownership과 COW를 사용하며, [RenderProvider](Nelyx/engine/platform/windows/skia_provider.hpp)의 Frame/Prepared는 GPU slot의 수명까지 보유된다. App의 ACK/NACK 전 생산자 참조와 Core의 publication·입력 snapshot 보유도 별도다. 이 경로들을 모두 “JS GC가 늦어서 해제되지 않는 메모리”로 묶어서는 안 된다.

조사할 대상은 **어느 snapshot이 얼마나 오래 유지되는지, compaction의 복사 비용과 해제 시점이 어디에 몰리는지**다. 캐시를 늘리거나 객체를 무조건 pool에 보관하면 live set과 old generation 생존량이 커질 수 있다. 반대로 모든 객체를 native로 옮겨도 대규모 `free`, reference-count 파괴, mutex 경합은 남을 수 있다. GC 없는 언어로 바꾸는 것만으로 회수 비용이 없어지지는 않는다.

young 수거에서는 죽은 객체를 일일이 일반 `free`하는 것만이 핵심 비용인 것도 아니다. 살아남은 객체의 이동·추적, roots/cards, finalizer 등도 함께 봐야 한다. 그러므로 allocation bytes만 줄인 비율을 GC 시간 개선율로 환산하지 않는다.

#### 3.7.7 기존 GC 숫자를 어디까지 믿을 수 있는가

[GCBase.cpp](.nelyx/windows-hermes/source/lib/VM/GCBase.cpp) 900–934행을 확인하면 `totalGCTime`·`maxGCPause`는 **`onMutator`인 이벤트의 wall time**을 집계한다. 배경 old 수거 전체 시간을 그대로 App 정지로 더하는 값은 아니다. `numCollections`는 `fromNewCollection` 기준이므로 **구간의 GC 완료 4회가 App 정지 4회를 의미하지 않는다.**

또한 [app_heap_clock.hpp](Nelyx/engine/platform/windows/app_heap_clock.hpp)는 누적 할당량·수거 완료 수·현재 allocated/heap/external counter를 시각에 연결하지만 각 GC의 시작·종료와 잠금 대기를 저장하지 않는다. **현재 `allocatedBytes`는 정확한 생존 객체량(live bytes)이 아니다.** 기존의 단계별 elapsed에는 GC가 포함될 수 있으며, 그 elapsed를 “GC와 별개의 순수 Source CPU”로 해석해서는 안 된다. young 수거 안에서 실행된 finalizer 시간은 해당 GC event 시간에 이미 포함되므로 둘을 다시 더하지 않는다.

다음 둘을 동시에 유지해야 한다.

- 단일 pause 최대 14–17ms는 기존 관측의 의미 있는 정보이며, 200ms급 단일 STW가 입증됐다는 설명과 맞지 않는다.
- 여러 pause, 진입 전 대기, native finalization, 일반 할당·생성 작업이 겹쳐 준비 기한을 놓칠 가능성은 남는다. 그 합과 offset의 관계는 별도 연결이 필요하다.

#### 3.7.8 조사 우선순위의 범위

이번 검토는 **GC·할당/해제 수명을 원인 분해에서 빼면 안 된다는 근거**다. GC의 기여도가 가장 크다거나 GC 수정이 VM 비교·UI 재설계의 필수 선행 조건이라는 근거는 아니다. 조사 범위를 “JS 코드가 느리다”에서 **JS 실행·할당, GC stop, GC 진입 대기, 외부 자원 회수, native 준비 대기**로 구체화하고, 같은 실패 구간의 시간 기여도에 따라 후속 수정을 선택한다.

### 3.8 Core의 공유 잠금과 이미 잠금 밖으로 분리된 작업

[Engine::State / dispatchImpl](Nelyx/engine/core/protocol/engine.cpp)는 하나의 `s.mutex`로 Engine의 공유 상태를 보호한다. input 수신, state/snapshot 조회, contentStep, tick·takeFrame·publish가 이 경계에서 만난다. owner가 여러 개여도 이 구간들이 동시에 상태를 변경하는 것은 아니다. 다만 **transaction 전체와 모든 native 준비가 이 잠금 안에서 실행된다는 설명도 틀리다.**

| 경계 | 실제 코드 | 검토 의미 |
| --- | --- | --- |
| transaction staging | `transactionActive`를 세운 뒤 잠금을 풀고 `transact` 실행, 재획득 후 자원 revision·종료 상태를 검증해 설치 | 무거운 transaction 구성을 처음으로 잠금 밖에 옮기자는 제안은 기존 구현과 중복 |
| Core contentStep | 잠금 안에서 `View::contentStep` → `LayoutWork::step(quota)` 실행 | quota는 작업 횟수이지 ms deadline이 아님. 실제 lock-held 시간을 확인해야 함 |
| provider의 문단 측정·그림 기록 | [contentLoop](Nelyx/engine/platform/windows/host.cpp)가 snapshot을 얻은 뒤 `ContentProvider.measure/prepare` 실행 | Core 잠금 밖이지만 같은 Content mailbox owner를 점유할 수 있음 |
| tick·Frame 생성·게시 | 잠금 안에서 활성화·입력/overlay 갱신·Frame 구성·snapshot 처리를 수행 | Render가 C++이라는 이유만으로 CPU·snapshot 복사 비용을 제외하지 않음 |

근거는 [engine.cpp](Nelyx/engine/core/protocol/engine.cpp), [scheduler.cpp](Nelyx/engine/core/scheduler/scheduler.cpp), [LayoutWork::step](Nelyx/engine/core/layout/layout.cpp), [ContentProvider](Nelyx/engine/platform/common/skia_provider.hpp)다. Core 경합, Content queue 대기, GC의 `gcMutex_`, 회계의 `Ledger::gate`는 **서로 다른 잠금·대기 경로**다. 현재 [host.cpp](Nelyx/engine/platform/windows/host.cpp)의 bounded trace에는 `queueMs`·`lockWaitMs`·`lockHeldMs`, Content timing에는 `measureMs`·`recordMs`가 이미 있다. 새 계측을 확대하기 전에 이 경계를 재사용한다. 이번 검토는 경로의 존재를 확인한 것이며, 최신 234ms 정체에서의 기여 시간을 측정한 것은 아니다.

## 4. Hermes, AOT, iOS 전제를 다시 정리한다

### 4.1 서로 다른 세 가지를 같은 AOT로 취급하면 안 된다

| 실행 형태 | 사전에 만드는 것 | 실행 중 남는 것 |
| --- | --- | --- |
| Hermes HBC | 최적화된 bytecode | VM의 bytecode 해석, 동적 객체·호출·메모리 관리 |
| 현재 Demo의 SH native unit | JS에서 생성한 C를 컴파일한 기계어 코드 | Hermes runtime, 동적 JS 의미, 객체·속성·호출·GC 관련 비용 |
| 정적 타입 정보를 활용한 native compilation | 타입·표현·호출 정보를 이용해 최적화한 기계어 | 언어와 코드에 따른 runtime/GC 및 실제 UI 작업 |

현재 [engine-v2-native-unit.mjs](Nelyx/sdk/tooling/cli/src/engine-v2-native-unit.mjs) 62–63행은 **`typed: false`, `requireNumeric: false`**다. host는 실제 `evaluateSHUnit`을 호출한다. 따라서 “지금도 bytecode만 해석한다”는 설명은 틀리지만, “TypeScript 정적 타입을 활용해 전체 UI가 최적화된 native 코드가 됐다”는 설명도 틀리다.

이는 최신 검증 기록에서 명시적으로 선택한 Demo native unit의 경로다. Testbed의 HBC나 SDK 기본 실행 전체가 native로 전환됐다는 뜻은 아니다. 이 빌드는 `typed: false`와 `windowsHermesPolicy('optimized', ...)`를 함께 사용한다. untyped를 “최적화되지 않은 코드”와 같은 뜻으로 쓰지 않는다.

이 native unit도 같은 VM의 GC-managed 객체를 사용한다. **native/HBC 대조의 양쪽 실패는 GC 원인을 배제하지 않는다.** 반대로 다른 VM으로 변경하면 JIT뿐 아니라 객체 표현·할당기·GC 정책도 바뀌므로, 빨라진 이유를 분리해야 한다.

현재 번들 JS에 타입이 지워진 뒤 compiler 옵션 하나를 켠다고 원래 TS 타입·동적 객체의 정확한 표현 정보가 복원되지는 않는다. Typed Hermes를 선택한다면 언어 지원, 타입 보존, 동적 경계와 전체 공급 경로를 따로 설계해야 한다. upstream `static_h` 문서도 typed language를 개발 중·불안정 상태로 설명하고 TypeScript 문법 지원을 부분적으로 명시한다. 이 문서는 이동하는 개발 브랜치의 설명이며, 현재 고정 revision의 지원 범위나 제품 안정성을 보증하지 않는다. [Hermes typed language](https://github.com/meta/hermes/blob/static_h/doc/TypedLanguage.md).

### 4.2 현재 Windows의 Hermes는 JIT를 켜는 것으로 해결되지 않는다

[windows-native-hermes-toolchain.mjs](Nelyx/sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs) 214행은 `HERMESVM_ALLOW_JIT=0`을 지정한다. 현재 고정 revision은 `b464dba92ad87bcfb77fae381a49a2394d9836d9`다.

그 revision의 JIT 설정은 자동 활성화를 ARM64 계열에 두고 iOS 계열을 제외한다. Windows x64에서 옵션만 바꿔 사용하는 해결책이 아니다. 또한 이 baseline JIT는 bytecode/source에서 hot 함수를 native로 옮기는 경로이며, 이미 SH native로 만든 함수를 V8처럼 다시 최적화한다는 뜻이 아니다. [고정 revision의 JIT 설정](https://github.com/meta/hermes/blob/b464dba92ad87bcfb77fae381a49a2394d9836d9/include/hermes/VM/JIT/Config.h), [실행 모드 문서](https://github.com/meta/hermes/blob/b464dba92ad87bcfb77fae381a49a2394d9836d9/doc/blog/2025-11-02-hermes-compilation-runtime-modes.md).

### 4.3 iOS의 제약은 Hermes 종속성이 아니다

일반 iOS 배포 앱은 특별한 JIT entitlement를 전제하지 않는 실행 경로로 검토한다. 다만 EU·일본의 대체 브라우저 엔진에는 JIT 등을 허용하는 별도 조건과 entitlement가 있으므로 “어떤 iOS 앱도 JIT를 사용할 수 없다”라는 절대 표현도 부정확하다. 이 브라우저 용도의 예외를 Nelyx 같은 범용 UI SDK의 권한으로 간주하지 않는다. [EU 대체 브라우저 엔진](https://developer.apple.com/support/alternative-browser-engines/), [일본 대체 브라우저 엔진](https://developer.apple.com/support/alternative-browser-engines-jp/), [App Review 2.5.6](https://developer.apple.com/app-store/review/guidelines/#software-requirements).

또한 다운로드 코드에 관한 2.5.2와 CPU의 실행 메모리 제약은 다른 문제다. 번들에 포함한 interpreter로 앱 로직을 실행하는 것 자체를 2.5.2가 전면 금지하는 것으로 해석하면 안 된다. [App Review 2.5.2](https://developer.apple.com/app-store/review/guidelines/#software-requirements).

반대로 **no-JIT라는 사실만으로 iOS 지원이나 App Store 배포 가능성이 입증되지는 않는다.** 사용하는 API·코드 공급 방식·패키징·서명 및 실제 기기의 실행을 따로 확인해야 한다.

현실적인 선택지는 다음과 같다.

| 선택 | iOS에서의 원리 | 판단 시 주의점 |
| --- | --- | --- |
| Hermes interpreter / 사전 native code | JIT 없이 앱 실행 | 현재 Nelyx Windows 성공이 Apple host·배포 성공을 뜻하지 않는다. |
| JavaScriptCore 임베딩 | Apple이 앱 내 JS 평가 API 제공 | `JSContext`를 쓰면 Safari와 같은 JIT 성능을 얻는다고 가정하면 안 된다. |
| V8 JIT-less | 실행 중 executable memory를 만들지 않는 실행 모드 | V8 JIT의 이득을 그대로 유지하는 선택이 아니다. 공급과 host 기능도 검증 대상이다. |
| Dart/Flutter, Kotlin/Native, C++ 등의 사전 컴파일 | native 코드로 배포 | 언어·프레임워크 변경 비용이 있지만 Hermes는 필요조건이 아니다. |
| WKWebView 기반 제품 | HTML/CSS/JS와 WebKit이 UI 실행을 담당 | native Core를 그대로 둔 VM 교체가 아니라 렌더링·입력·통신 모델 변경이다. |

근거: [JavaScriptCore](https://developer.apple.com/documentation/javascriptcore.md), [V8 JIT-less](https://v8.dev/blog/jitless), [Flutter iOS 실행](https://docs.flutter.dev/resources/faq#how-does-flutter-run-my-code-on-ios), [Kotlin/Native](https://kotlinlang.org/docs/native-overview.html), [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview.md). V8 JIT-less 문서는 모드의 원리를 확인하는 자료이며, 2019년 benchmark 수치를 현재 Nelyx의 예측에 사용하지 않았다.

### 4.4 현재 프로젝트에는 별도의 iOS 구현 공백도 있다

[engine-v2-runner.mjs](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs) 234–245행은 공급 대상을 **Windows/Web/Android**로 제한한다. 현재 v2의 iOS host는 이 경로에서 공급하지 않는다. 루트 README의 오래된 플랫폼 표나 [Hermes provider metadata](Nelyx/sdk/providers/hermes-supply.json)에 Apple pin이 있다는 사실로 v2 iOS 지원이 완성됐다고 보면 안 된다.

한편 [apple-runner.mjs](Nelyx/sdk/tooling/cli/src/apple-runner.mjs)에는 React/React Native cohort 기반의 별도 Apple runner가 있다. **v2의 공급 공백과 저장소 전체에 Apple 관련 코드가 없다는 주장은 다르다.** 기존 Apple 자산의 재사용 가능성과 v2의 표면·입력/IME·접근성·lifecycle·font/resource·서명/패키징 연결, 실기기 성능은 따로 확인해야 한다. 미검증 iOS 가능성만을 이유로 Windows에서 실패한 설계를 무기한 유지하는 것도 합리적이지 않다.

## 5. 초기 기술 스택의 대안 비교

아래 평가는 Nelyx의 현재 코드와 목표에 대한 설계 판단이다. 다른 프레임워크에서 같은 달력을 실행해 얻은 성능 순위가 아니다. 비용은 상대적 범위이며 일정 견적이 아니다.

| 방향 | TypeScript 자산 | iOS 적합 경로 | 실제로 달라지는 것 | 비용·위험 | 권고 |
| --- | --- | --- | --- | --- | --- |
| 현재 구조 + 원인 미분리 상태의 국소 최적화 반복 | 가장 많이 유지 | 기존 후보 유지, Apple host 필요 | 개별 연산·할당의 감소 가능성 | 변경은 작지만 실패 원인을 남긴 채 반복할 위험 큼 | 근거 없는 반복은 중단. 입증된 비용의 수정까지 금지하지 않음 |
| **현재 Core·VM + 메모리 수명/회수 경로 개선** | 대부분 유지 | no-JIT 원칙 유지, Apple host 필요 | 임시 graph·buffer 보유·GC 중 native 해제 비용의 개선 가능성 | 수명·불변 snapshot·회계 보존 필요. 병목 기여도와 성능 효과 미측정 | **원인 분해 후 선택할 수정 후보** |
| 현 구조에서 V8/JSC만 교체 | 대부분 유지 | JIT-less/JSC 등 별도 확인 | JS 실행 속도·GC·시작 특성 | host 결합과 플랫폼별 차이. Source/coverage 구조는 그대로 | 원인 분리용으로 제한 |
| **TS + 작은 실행 계약 + 기존 C++ Core** | 앱·비즈니스 로직 재사용 여지 큼, UI 내부는 변경 | JS interpreter + native UI 작업 | 새 UI 생성과 고빈도 갱신의 작업량·왕복 축소를 목표로 함 | 프레임워크 일부 재설계, 원본 Source 내부 호환 범위 축소 | **Source 작업량이 핵심으로 남고 TS SDK가 목적일 때** |
| **원본 Flutter/Dart** | TS UI 구현은 대부분 이전 필요 | 공식 native AOT 경로 | 자체 Source 변환기·TS Flutter 재구현·투영 경계 제거 | UI·플러그인 이전. 앱별 성능 확인 필요 | **제품 완성이 목적이면 우선 평가** |
| React Native + 필요한 native UI | 비즈니스 로직·TS 도구 재사용, UI API 재작성 | RN의 iOS 실행 경로 | UI·플랫폼 유지 책임을 RN/native로 이전 | Flutter API·동일 자체 렌더링 포기, Windows/Web 범위 별도 검토 | TS 앱 제품의 대안 |
| Compose Multiplatform / Kotlin | TS 직접 재사용 적음 | Kotlin/Native 기반 Apple 경로 | UI 프레임워크·언어 교체 | Material/Cupertino 의미와 desktop/web 경로 재검토 | Kotlin 생태계가 우선일 때 |
| Web UI + WKWebView 등 | TS 친화적, 현재 canvas 경로 일부 활용 가능 | WebKit | Web 렌더링·입력 모델로 전환 | 브라우저 경계·IME·접근성·native 통신 재설계 | Web 중심 제품일 때 |
| C++/Rust 중심 자체 UI 전면 재작성 | TS UI 재사용 매우 적음 | 사전 컴파일 가능 | 프레임워크의 대부분 재작성 | 텍스트·위젯·편집·접근성까지 장기간 재구현 | 현재 근거로 비추천 |

Flutter는 기존 Widget/Element/RenderObject 개념과 Material/Cupertino 목표에 가장 가까운 외부 대안이다. 공식 프레임워크와 앱을 native로 컴파일한다는 점은 현재 untyped JS native unit과 구분해야 한다. **Dart도 GC를 사용하며, Flutter 전환은 GC 제거가 아니라 객체 표현·수명·프레임워크 구현을 포함한 전체 실행 경로 변경**이다. native compilation이 잘못된 rebuild나 과도한 작업량을 자동으로 해결하는 것은 아니다. [Flutter FAQ](https://docs.flutter.dev/resources/faq).

React Native는 JS가 바쁜 동안에도 native ScrollView가 이동할 수 있는 구조를 설명한다. 하지만 새 목록 항목의 생산비용까지 사라지는 것은 아니다. RN/Skia를 선택해도 그 위에 현재와 같은 전체 TS Source 트리를 다시 만들면 같은 종류의 문제를 재현할 수 있다. [RN 성능 문서](https://reactnative.dev/docs/performance).

Compose Multiplatform은 UI 공유와 iOS 경로를 제공하는 별도 대안이다. Nelyx의 TypeScript 및 Flutter API를 자동으로 보존하는 선택은 아니다. [KMP 공식 FAQ](https://kotlinlang.org/docs/multiplatform/faq.html), [Kotlin/Native](https://kotlinlang.org/docs/native-overview.html).

### 5.1 지금 추가로 쫓지 않을 후보

- **QuickJS로 바꾸면 native AOT가 된다:** `qjsc`의 C 출력에는 bytecode와 엔진 초기화 코드가 들어간다. JS 함수 전체를 정적 native 연산으로 바꾸는 것과 다르다. Nelyx를 더 빠르게 한다는 근거도 아직 없다. [QuickJS executable generation](https://bellard.org/quickjs/quickjs.html#Executable-generation).
- **TS를 Wasm으로 내리면 전체 코드가 그대로 빨라진다:** AssemblyScript는 TypeScript의 변형이며 전체 TS를 지원하지 않는다. 현재의 동적 객체·callback·Dart 의미 호환을 자동 이전하는 대안이 아니다. Wasm도 native iOS에서 어떤 실행 방식으로 돌릴지 별도 결정해야 한다. [AssemblyScript 소개](https://www.assemblyscript.org/introduction.html).
- **Typed Hermes compiler 개발을 먼저 확대한다:** 현재 문제 해결을 compiler·언어·플랫폼 이식까지 포함하는 별도 연구로 확대할 수 있다. 작은 독립 범위에서 가능성을 확인하기 전에는 전체 프레임워크의 전제에 넣지 않는다.
- **C++을 Rust로 바꾸거나 Graphite를 다른 GPU backend로 먼저 교체한다:** 현재 가장 직접적인 증거가 있는 TS Source·투영 비용을 없애지 않는다. 메모리 안전성 등 다른 목표는 별도 논의다.

## 6. TypeScript를 유지한다면 어디를 다시 설계해야 하는가

이 절은 §3.7·§8의 원인 분해 결과 Source 생산비용이 핵심으로 남을 때의 설계 대안이다. GC를 포함한 실제 비용을 확인하지 않은 채 바로 실행하도록 권고하는 것은 아니며, GC 관련 수정을 반드시 먼저 해야 한다는 뜻도 아니다.

### 6.1 먼저 구분할 것은 공개 의미와 내부 표현이다

현재 계약도 비공개 반복 표현의 제거를 허용한다. 따라서 “최적화하려면 먼저 호환성을 포기해야 한다”는 결론으로 시작하지 않는다. 다만 새 표현이 공개 identity·사용자 override·동기 관찰·callback 순서를 바꾼다면 명시적인 계약 변경이 필요하다. 다음 세 요구를 동시에 무제한 보장할 수는 없다.

- 일반 TypeScript/JavaScript의 동적 확장과 임의 callback을 허용한다.
- 공개 identity·상태 수명·override·동기 관찰·callback 순서를 보존한다.
- 느린 no-JIT 기기에서도 새 subtree 생성이 항상 짧은 시간 안에 끝난다.

어떤 언어에서도 임의로 오래 실행되는 사용자 함수를 일정 시간 안에 완료시킬 수는 없다. Nelyx가 보장해야 할 것은 지원하는 UI 표현과 작업량의 범위를 명확히 하고, 그 범위에서 deadline을 맞추는 것이다.

이 일반적인 한계가 현재 Calendar에서 공개 API 변경이 필수라는 증명은 아니다. 우선 비공개 wrapper·중복 표현을 줄이되 기존 앱의 공개 identity, 사용자 callback, State 수명은 보존한다. 그것으로 부족해 제한된 새 표현을 도입한다면 opt-in·버전과 지원 범위를 드러낸다. 현재 [OriginalWidgetHost.unsupported](Nelyx/runtime/app/host.ts)는 미지원 기능을 오류로 거부하며 TypeScript renderer로 자동 fallback하지 않는다. 별도의 호환 경로로 되돌리는 기능이 이미 있다고 가정해서는 안 된다.

이는 보고서의 제안이며, 현재 W11의 의미 보존 조건을 임의로 변경하거나 기존 작업을 완료 처리한 것이 아니다.

### 6.2 Source graph를 줄이려면 생성 이전의 경계가 달라져야 한다

| 기존 W11 계열에서 이미 한 일 | 다음 설계에서 검토할 차이 |
| --- | --- |
| 만들어진 RenderObject를 direct binding으로 전송 | 지원되는 반복 UI는 처음부터 일반 Widget/Element/RenderObject graph 전체를 만들지 않는 표현 |
| 기존 subtree·program·command 재사용 | 반복 항목의 구조와 데이터를 분리해 새 항목도 작은 데이터 입력으로 생성 |
| fitted calendar grid의 native layout program·숫자 식 공유 | 같은 배치를 다시 C++로 옮기는 것이 아니라 그 전에 생성하는 Source graph·변환 작업을 실제로 줄임 |
| render setter의 dirty field journal | 공개 상태 변경이 native owner의 필요한 필드에 바로 연결되는 명시적 binding |
| native가 기존 coverage 안에서 scroll | 새 coverage 생산도 제한된 작업으로 완료할 수 있는 내용 생성 계약 |
| 관찰 가능한 Source 의미를 보존한 생성기 최적화 | 어떤 표현은 compile-time plan으로 낮추고, 동적 표현은 별도 경로로 구분 |

예를 들어 달력은 월·날짜·라벨·enabled/selected 상태와 셀의 구조를 분리할 수 있다. TS는 앱 상태와 필요한 사용자 결정을 담당하고, 제한된 셀 구조의 생성·배치·기본 포인터 반응은 native가 처리할 수 있는 데이터와 명령으로 전달한다.

그러나 `selectableDayPredicate`, 테마 resolver, 사용자 정의 builder처럼 실행이 필요한 코드를 C++로 “자동 이전”한다고 가정해서는 안 된다. 해당 callback은 정의된 시점에 TS에서 실행하고 결과를 전달하거나, 새 API에서 허용하는 표현을 제한해야 한다. Focus·키보드 이동·Semantics·Ink 동작도 새 모델에서 구현해야 하며 그림만 같은 것으로 완료할 수 없다.

달력 한 개를 특수 C++ 위젯으로 만드는 것으로 끝내지 않는다. **같은 반복 항목 모델이 가변 길이 텍스트 목록에도 적용되는지** 확인해야 SDK 방향의 근거가 된다. 다만 [WidgetHost](Nelyx/runtime/engine-client/widgets.ts)는 임시 data-Widget frontend이며, 자체 TS Element reconcile·State/build·SceneNode snapshot을 유지한다. 이것으로 frontend만 바꿨다고 Source graph가 사라지는 것은 아니다. [Scene/RenderBinding](Nelyx/runtime/engine-client/scene.ts)도 전송·재사용 경계이지 native 위젯 전체를 자동 생성하는 기능은 아니다. 새 모델은 어떤 생성·변환 작업을 없애는지 별도로 증명해야 한다.

### 6.3 실제 소유권을 단순하게 한다

제안하는 책임은 다음과 같다.

| 담당 | 소유할 것 |
| --- | --- |
| TS 앱 | 비즈니스 상태, 이벤트 처리, 사용자 callback, 명시적 UI 데이터 변경 |
| 지원 UI 표현/생성 단계 | 정적인 구조, 데이터 슬롯, 의존성, 변경 가능한 필드의 계획 |
| native UI owner | 해당 경로의 실제 render 상태, layout·hit test·기본 동작·semantics 자료 |
| 기존 Content/Render | 자원 준비, 그림과 프레임 게시, 디바이스·표시 수명 |

여기서 native UI owner는 새 OS 스레드의 도입을 뜻하지 않는다. 현재 Core도 이미 layout·scroll·gesture/control·편집·hit test와 semantics 자료를 처리한다. 추가 제안은 그 기능을 다시 만드는 것이 아니라, 제한된 UI 데이터에서 native 노드·이벤트 identity를 구성하는 책임과 Source에서 생략할 작업을 정하는 것이다. 원본 Widget/State/callback의 생명주기가 자동으로 C++로 이전되는 것은 아니다.

이 설계에서도 correctness를 위한 snapshot과 세대 정보는 필요하다. “하나의 tree”라는 표현 때문에 스레드가 같은 mutable 객체를 무단 공유하게 만들지 않는다. 없애려는 것은 같은 의미를 매번 여러 형태로 해석하는 작업이지, 필요한 일관성 경계 전부가 아니다.

임의 JS closure는 native 스레드에서 직접 실행할 수 있는 데이터가 아니다. 기본 동작과 앱 callback을 분리하고, 결과가 필요한 사용자 callback은 명시적인 왕복으로 남긴다. 고빈도 입력 경로에 그 왕복이 반드시 필요한 경우에는 그 비용까지 새 계약에 포함해야 한다.

### 6.4 기존 준비·게시 분리를 확장할 때도 미완성 상태를 노출하지 않는다

현재도 accepted document, Content 준비, active scene, published frame은 분리되어 있고 builder 응답에 대한 layout resume가 있다. 그러나 [View](Nelyx/engine/core/state.hpp)는 기본적으로 하나의 `preparing`과 최신 `demand`를 유지한다. 독립 subtree를 여러 준비 단위로 진행하는 것은 단순한 대기 삭제나 worker 추가가 아니라 준비 단위·취소/재기반화·budget 계약을 바꾸는 제안이다. 필요성이 확인될 때만 검토하고, 합류 시 document/node generation, metrics, device, font, resource 조건과 게시 원자성을 유지한다.

작업 분할은 부수 효과가 없는 계산이나 명시적 생명주기 경계에 한정한다. 실행한 callback을 취소 후 다시 호출하거나, 오래된 좌표와 새 semantics를 섞거나, 중간 상태를 공개하는 방식은 허용하지 않는다. 현재 `waitForContent`를 단순 삭제하는 수정과는 다르다.

또한 **미리 준비할 데이터가 전혀 없는데, 무한 속도 입력을 받아도 빈 영역 없이 항상 이동한다는 보장은 불가능하다.** 이번 후보는 기존 입력·resident·lead 조건에서 생산비용을 낮추는 것으로 평가한다. 준비 창 확대, 입력 감속, placeholder 허용은 별도 제품 정책 변경이며 동일 조건의 성능 해결로 보고하지 않는다.

## 7. 바닥부터 다시 만들 필요가 있는 부분과 보존할 부분

현재 확정할 수 있는 것은 **성능이 미수락 상태이며 준비 지연의 원인은 아직 분리되지 않았다는 점**이다. 메모리 수명·회수를 포함한 비용 분해 결과에 따라 상위 UI 생성 경로의 선택적 교체를 판단한다. 엔진 전면 폐기까지 정당화되지 않는다.

| 자산 | 제안 |
| --- | --- |
| C++ layout·scroll·hit test·문단 및 자원 처리 | 재사용을 우선한다. 새 경로에서도 해당 구현의 성능·정확성을 개별 검증한다. |
| Windows 입력·IME/UIA·표면·종료 수명 처리 | 유지 후보. 특히 이미 해결한 플랫폼 계약을 다시 만드는 비용을 피한다. |
| Web/Android runner와 공급 도구 | 사용 가능한 범위를 유지한다. iOS까지 완료된 자산으로 계산하지 않는다. |
| generation·문서·자원 수명·ACK/NACK 계약 | 필요한 원칙을 보존한다. 무효화 범위나 transaction 단위는 근거에 따라 단순화할 수 있다. |
| TS 비즈니스 코드, 날짜/선택/로컬화 의미, 기능 fixture | 새 구현의 입력과 동작 비교 기준으로 활용한다. |
| Flutter Source를 광범위하게 재현하는 TS 위젯 경로 | 새 고성능 경로의 필수 기반으로 계속 확대할지 재결정한다. |
| 범용 capture→scene 변환 경로 | 호환 경로로 남기거나 범위를 축소한다. 모든 새 UI가 반드시 통과하게 하지 않는다. |
| Hermes 전용 host 기능 | VM 교체가 실제 필요해질 때만 작은 runtime adapter로 분리한다. 여러 VM 제품화를 동시에 시작하지 않는다. |

원본 Flutter로 전환한다면 재사용 판단은 달라진다. Nelyx 전체 엔진을 Flutter 안에 다시 넣기보다 필요한 native 서비스·도메인 로직만 plugin/FFI 대상으로 검토하는 것이 자연스럽다. UI와 Core를 이중으로 유지하면 없애려던 경계를 다시 만들 수 있다.

## 8. 다음 작업의 순서와 중단 기준

이번 보고서는 실행 계획의 권고다. 기존 `work11-1.md` 작업을 자동 재개하지 않는다.

### 8.1 생성·보유·회수와 준비 대기 경로를 함께 분석한다

실행 계측을 확대하기 전에 다음 소유권 표를 코드로 완성한다. 아래는 이번에 확인한 시작점이며 아직 각 비용의 순위는 아니다.

| 조사 경로 | 먼저 답할 질문 | 결과에 따른 수정 후보 |
| --- | --- | --- |
| Source rebuild → capture → scene records | private 임시 표현과 실제 State/Widget 중 무엇이 얼마나 반복 생성되는가? 기존 변경으로 제거한 graph와 남은 graph는 무엇인가? | 관찰 불가능한 반복 표현의 생성을 없애거나 동일 owner 안에서 재사용. 공개 identity·callback은 유지 |
| App text API → 동기 JSI → AppParagraphs | Source elapsed 안에서 native layout/query·geometry 변환·release가 차지하는 시간은 얼마인가? Content 측정과 어떤 조건에서 별도로 실행되는가? | 확인된 중복 변환·측정·회수 비용을 축소. native 구현이라는 이유로 App 비용에서 제외하지 않음 |
| accepted/pending/observation snapshot → retirement | 마지막 소비자는 누구인가? ACK·publication 이후에도 필요 없이 붙잡은 참조가 있는가? | 불필요한 보유 해소. JS에 노출된 view가 살아 있는 동안 backing을 재사용하지 않음 |
| ResponseBuffer → external pressure → finalizer | 어떤 응답이 pressure와 최종 파괴를 집중시키는가? 마지막 shared owner는 어느 경로에서 해제되는가? | 불필요한 응답량 감소 또는 확인된 무거운 native 파괴의 지연 처리 설계 |
| GC 진입 → background pause → `gcMutex_` | App이 기다리는 동안 background는 무엇을 하고 어떤 잠금을 갖는가? | 실제 긴 경합 경로가 확인될 때 잠금 범위·작업 단위 축소 |
| finalizer → ExternalLease → `Ledger::gate` | finalizer가 만나는 mutex를 다른 owner가 오래 보유하는가? 잠금 순서가 일관적인가? | 회계·수명 의미를 유지하는 짧은 반환 경로 또는 분리 회수 후보 |
| mailbox → Core dispatch / `s.mutex` | queue 대기·lock wait·lock held 중 무엇이 긴가? transaction staging의 잠금 해제와 provider의 잠금 밖 작업을 구분했는가? | 기존 trace를 먼저 사용하고 실제 긴 직렬 구간만 축소. 이미 분리된 작업을 다시 분리하는 개편은 하지 않음 |
| Source 제출 → Content 준비 → activation/publication/coverage | Source 종료 뒤 어떤 작업·게시 조건을 기다리는가? 독립된 준비를 불필요하게 직렬화하는가? | 실제 의존성을 보존하면서 준비 단위·게시 장벽을 조정할 후보 |

native 회수를 GC 밖으로 넘기는 후보는 **아직 채택하지 않았다.** 도입한다면 GC callback에서 큰 할당·대기 없이 넘길 수 있어야 하고, 회수 대기 bytes도 실제 해제까지 ledger에 남아야 한다. backing 파괴와 별도로 차감되는 GC pressure 및 기존 중복 차감 방지 counter도 검토해야 한다. queue는 bounded여야 하며 overflow·종료 drain·스레드 소유 자원의 파괴 규칙도 정해야 한다. App 전용 문단과 GPU slot 자원을 일반 회수 스레드에서 임의 파괴할 수는 없다. 단순히 `free`를 다른 스레드로 보내 통계를 낮추는 것은 완료가 아니다.

#### 8.1.1 그다음 최소 계측으로 가설을 반증한다

현재 bounded App/source 기록을 활용하고, 결론에 필요한 다음 경계만 추가하는 것이 적절하다.

1. **기존 queue·Core·Content 시간:** `queueMs`·`lockWaitMs`·`lockHeldMs`와 `measureMs`·`recordMs`를 같은 실패 구간에 먼저 연결한다. 이미 있는 경계를 위한 별도 전면 profiler를 새로 만들지 않는다.
2. **App 동기 native 시간:** 필요하면 backend layout/query/release의 시간만 bounded 방식으로 구분한다. `sdkLayouts`·native layouts 등의 호출 수를 실행 시간으로 바꾸거나 App 투영의 `paragraphPreparations`로 대신하지 않는다.
3. **같은 QPC 기준의 GC 구간:** 종류·실행 스레드·cause·시작/끝을 연결한다. 공개 `GCConfig::Callback`·`AnalyticsCallback`의 호출 위치를 확인해 사용하고, 분석 이벤트의 세대별 allocated/size/external·survival ratio를 전체 heap의 정확한 live bytes로 바꾸어 부르지 않는다. background 전체 경과도 App 정지로 취급하지 않는다.
4. **GC 진입 전 잠금 대기:** 공개 collection start보다 앞선 `ensureBackgroundTaskPaused`/잠금 경계는 별도로 잰다. 기존 최대 pause 통계만으로 이 비용을 대신하지 않는다.
5. **외부 버퍼 회수:** holder 수·live bytes·pressure, finalizer 실행 시간·실행 스레드, 마지막 native 해제와 ledger 잠금 대기. App 문단의 명시적 release·GPU 자원 retirement와 분리하며 JS 누적 allocation counter가 native bytes를 모두 포함한다고 가정하지 않는다.
6. **화면과의 연결:** 같은 Source pass/document/preparation/publication 및 offset 구간에 연결한다. 중첩 정지는 시간 구간의 합집합으로 처리하고, GC나 native 호출을 뺀 elapsed도 자동으로 CPU self time이라 부르지 않는다.

collector callback에서는 Runtime을 다시 호출하지 않는다는 upstream 계약을 지킨다. hook 안에서 문자열·배열을 누적하거나 파일을 쓰지 않고, 다중 스레드 안전한 고정 크기 기록을 사용한다. overflow·측정 overhead를 별도 표시한다. 공개 callback의 ms 단위 분석 이벤트와 정밀 QPC 경계도 구분한다. 이는 **후속 검증 설계이며 이번에 도구를 구현하거나 실행한 것은 아니다.**

처음 비교는 같은 공급·입력의 일반 실행과 짧은 진단 실행으로 한정한다. code-level 비용 경로를 고친 후보만 대조하고, GC 설정·준비 창·입력 속도를 동시에 바꾸지 않는다.

| 관측 결과 | 다음 판단 |
| --- | --- |
| GC 정지·진입 대기가 새 월 준비 지연의 큰 부분과 겹침 | 할당 생존량·pressure·GC 경합 개선 우선. 원인에 맞는 heap/수거 정책 대조를 그다음 진행 |
| buffer finalizer/native 해제·ledger 대기가 큼 | 외부 자원 수명과 회수 경로부터 개선. 전체 UI API 변경을 먼저 하지 않음 |
| App의 동기 native 문단 작업이나 Core/Content queue·잠금 대기가 큼 | 해당 native 작업·직렬 구간을 먼저 검토. JS VM 교체나 Source 객체 제거만으로 해소된다고 가정하지 않음 |
| 같은 실패 구간에서 GC·회수·진입 대기는 작고 allocation/일반 생성 작업이 큼 | GC 설정 변경을 선행 조건으로 삼지 않고 Source·projection 작업량 축소 및 §6의 UI 생성 모델 재설계 |
| App 준비가 기한 안에 끝나도 offset 정체가 남음 | Content 준비·coverage·publication의 실제 의존 경로 분석 |
| 다른 VM에서만 통과 | JIT·GC·allocator 차이를 분리하고 no-JIT/iOS 후보의 적합성을 별도 판단 |

GC·회수 비용이 같은 실패 구간의 지연을 설명하지 못하면 해당 가설의 우선순위를 낮춘다. 반대로 GC와 지연이 겹친다는 사실만으로 인과를 확정하지 않고, 확인한 경로 하나만 바꾼 대조로 효과를 확인한다. 어느 경우에도 GC 관련 패치를 반드시 만든 뒤에야 다른 원인을 조사하는 순서로 고정하지 않는다.

**초기 해법으로 채택하지 않을 것:** 스크롤마다 강제 full GC, 외부 pressure 제거, 무제한 heap 확대, 모든 객체의 pool 유지, 50ms 상수만 축소. 각 방법은 정지 위치·빈도·live set·회계 의미를 바꾼다. 확정된 가설에 대한 제한된 대조가 필요하다.

### 8.2 더 큰 UI 재설계가 필요할 때 먼저 정할 것

원인 분해에서 같은 Source 생산비용이 핵심으로 남고 “TypeScript UI SDK”를 유지한다면 §6의 부분 재설계를 검토한다. GC·회수의 기여도가 작다고 확인되면 해당 수정 없이도 이 판단으로 진행할 수 있다. 다음 세 가지를 짧은 설계로 고정한 뒤 구현해야 한다.

1. 보존할 공개 동작: 날짜 선택, 범위/disabled 상태, locale·RTL, 키보드·Focus, 접근성, resize와 상태 수명.
2. 새 경로에서 지원하는 표현과 동적 callback의 경계. 기존 경로로 돌아가는 조건 및 그 경우의 성능 보장 범위.
3. 새 월 하나가 만드는 객체·native 노드·transaction·Content 왕복의 경로. App capture created/captured 784/827, Core nodeCount, command·문단 실행 횟수를 각각 구분하고 무엇이 실제로 사라지는지.

이 단계에서 제거되는 실제 작업을 설명할 수 없다면 “새 엔진”이라는 이름만 붙여 구현을 시작하지 않는다.

### 8.3 V8 비교는 결론을 바꿀 수 있는 범위만 진행한다

현재 V8 초기화 실패에는 소스로 확인되는 유력 후보가 있다. [scene.ts](Nelyx/runtime/engine-client/scene.ts) 2979–2995행은 semantics snapshot이 `notFound`여도 그 응답을 `observed`에 넣고 `onState`로 보낼 수 있다. [host.ts](Nelyx/runtime/app/host.ts) 596–600행은 `status !== ok` 또는 viewport 부재를 오류로 거부한다.

이는 `onPublication` 관찰이 켜져 있고 `semanticState === state`인 분기에서 **live state와 아직 없는 publication의 계약이 섞일 수 있는 불일치**다. 다만 실패 당시 callback의 원본 값은 확보되지 않았으므로 해당 실행의 확정 원인이라고 하지 않는다. V8 전용 결함으로 확인된 것도 아니다. 먼저 두 상태의 의미와 freshness를 코드에서 분리해야 한다. sleep·오류 무시로 V8 startup을 통과시키는 접근은 비교 근거를 손상시킨다.

수정 후 비교한다면 동일 App·Core·Source·입력·resident·animation에서 Hermes native/HBC, V8 JIT, 지원 가능한 V8 JIT-less를 비교한다. VM startup·warmup과 cold 월 생성, JS 실행·GC, 외부 buffer/allocator·Content 대기와 offset을 구분한다. 현재 V8 진단은 외부 backing accounting 방식도 다르므로 그 차이를 통제·기록해야 한다. 다른 scene·의미·플랫폼으로 만든 작은 benchmark는 전체 앱의 대조를 대신하지 않는다.

| 비교 결과 | 의사결정 |
| --- | --- |
| 같은 V8 host·공급에서 JIT on은 통과하고 JIT-less는 실패 | JIT 모드에 따른 차이를 지지한다. GC·메모리 동작 변화도 포함해 분석하며 iOS no-JIT 경로에 통과 결론을 적용하지 않는다. |
| V8는 통과하고 Hermes는 실패하지만 같은 V8의 JIT on/off 대조는 없음 | VM·host 조합의 영향만 확인할 수 있다. JIT 단독 효과와 GC·allocator·외부 버퍼 처리 효과를 분리했다고 보고하지 않는다. |
| no-JIT 후보에서도 동일 앱이 충분히 통과 | 구조 교체보다 작은 VM/host 전환이 합리적인지 다시 평가한다. Windows 통과가 실제 iOS 지원·배포 검증을 대신하지는 않는다. |
| Source는 빨라지지만 정체가 남음 | 남은 capture/scene·Content·coverage·게시 지연을 분해한다. Source 일부의 개선만으로 Core 재설계가 필요하다고 확정하지 않는다. |
| runtime 간 차이가 작음 | VM 외의 Source 작업량·중간 표현·Content 및 게시 의존을 조사한다. 단일 대조로 VM 영향을 완전히 배제하지 않는다. |
| 비교 host의 완성 비용이 계속 증가 | VM 제품화로 확대하지 않고 멈춘다. 비교 미완료 상태를 남기고 구조 분석을 진행하되, 비교 실패를 구조 원인의 증명으로 삼지 않는다. |

V8 결과가 나와야만 원인을 분석할 수 있는 것은 아니다. §8.1의 원인 분해를 우선하되, runtime 비교가 결론을 바꿀 수 있다면 제한된 범위에서 사용한다. 수명·GC 수정의 완료를 비교의 절대 선행 조건으로 두지는 않는다.

### 8.4 한 기능의 처음부터 표시까지를 연결한 후보를 만든다

권고 범위는 달력의 월 이동·날짜 선택과, 같은 모델을 사용하는 텍스트 목록이다. 목적은 예쁜 화면 두 개가 아니라 **새 내용 생성부터 게시까지 실제 경로를 바꿀 수 있는지** 확인하는 것이다.

사전에 정할 판정 기준은 다음과 같다.

- [work11 §6.3](work11.md#63-새-성능-판정안)의 기준을 유지한다. 60Hz 표시 주기 $T=1000/60\,\mathrm{ms}$에서 입력→실제 이동을 반영한 게시 지연은 **p95 $\le 2T$, 최대 $\le 4T$**다. 약 33.3/66.7ms는 설명용 반올림값이지 별도 문턱이 아니다. 진행해야 하는 구간의 offset 무진행 ≥100ms는 0회이며 정지 명령·끝 경계·델타 0·정상 반전 순간은 제외한다.
- 기존 3배속 입력, 방향 반전·재접촉, 동일 resident/lead·animation 조건을 유지한다. warm 구간과 새 내용 생성 구간을 따로 판정한다.
- 새 경로의 Source/직렬 준비 예산은 위 end-to-end 목표와 실제 임계 경로에서 역산한다. 평균 월 이동 간격만으로 정하지 않는다. 기존 기준대로 필수 App 동기 구간이 한 refresh를 넘지 않는 것을 우선 목표로 하되 임의 사용자 callback의 상한을 보장하지 않는다.
- callback 결과·State 수명·Focus·Semantics·IME 등 변경된 기능 계약을 확인한다. 호환 fallback에서만 동작하는 기능을 새 경로 완료로 계산하지 않는다.
- missing/ring loss·진단 overwrite가 판정에 영향을 주면 지연 최대값·백분위를 `notVerified`로 남긴다. 입력 접수·`consumedThrough` 증가만으로 실제 offset 이동을 반영했다고 세지 않는다.
- 물리 트랙패드 사용감과 실기기 표시 결과를 별도로 확인한다. 소프트웨어 publication 측정을 scanout으로 부르지 않는다.

반복 수를 늘려 성공할 때까지 기다리는 방식은 피한다. 코드 가설이 바뀐 후보만 검증하고, 의미 있는 경로 하나를 바꾼 뒤에도 실패하면 잔여 비용과 원인 가설을 갱신한다. 저장소 지침에 따라 검사는 20분 timeout, 보통 30회 이내의 필요한 반복, 실행 종료 시 임시 산출물 정리를 사용한다.

### 8.5 전체 이식 전에 iOS 최소 구현·배포 가능성을 확인한다

후보를 모든 위젯으로 확대하기 전에 최소 iOS 앱을 실제 no-JIT/native 배포 경로로 연결해야 한다. Mac/Xcode와 실제 기기에서 font·텍스트·입력·접근성·lifecycle을 포함한 한 화면을 확인한다. Windows에서의 V8 또는 SH 결과로 이 단계를 대체하지 않는다.

다음 중 하나라면 자체 UI 경로의 확대를 중단하고 Flutter 등 기존 프레임워크 전환을 우선한다.

- 공개 동작을 유지하려면 결국 같은 대규모 TS Source graph가 다시 필요하다.
- 새 모델의 핵심 기능이 대부분 기존 capture 경로로 돌아가 실질적인 경로 축소가 없다.
- no-JIT/iOS 조건에서 목표를 달성하지 못하고 JIT에만 의존한다.
- UI SDK 자체 개발보다 실제 앱 완성이 중요해져 compiler·플랫폼·위젯 유지 비용을 감당할 이유가 사라진다.

## 9. 최종 권고

**지금의 첫 과제는 같은 실패 구간에서 Source 실행·할당, App의 동기 native 문단 작업, GC·회수, mailbox·Core 잠금 대기, Content 준비·coverage 의존의 기여도를 나누는 것이다.** accepted·ready·active·published의 실제 경계와 기존 native layout·Frame 전달·COW 재사용을 기준으로 분석한다. GC와 외부 버퍼 수명은 빠뜨리면 안 되는 후보지만 최신 공급의 시간 기여도는 미확정이다. 단일 pause 최대값이나 native AOT 실패로 GC를 배제하지도, 이전 공급의 할당량만으로 최우선 원인으로 확정하지도 않는다.

확인된 병목 경로의 작은 수정부터 대조하고, 그 효과와 남은 비용으로 재설계 범위를 정한다. GC 기여도가 작다면 GC 수정 없이 Source·준비 구조의 판단으로 진행한다. TypeScript UI SDK가 프로젝트의 이유이고 더 큰 변경이 필요하다면 C++ Core와 플랫폼 자산을 살리면서 UI 생성·상태·native 소유권을 더 작은 계약으로 바꾸는 후보를 검증한다. 이때 일부 API·내부 호환성 정책의 변경이 필요할 수 있다.

TypeScript가 필수가 아니고 제품 완성이 우선이라면 원본 Flutter/Dart를 우선 평가할 수 있다. 그러나 현재 앱의 성능 해결이나 이전 가능성이 검증된 것은 아니고 GC를 제거하는 선택도 아니다. 다른 VM으로 바꾸는 것 역시 현재의 대량 생성·보유·해제 패턴을 자동으로 없애지 않는다.

현 시점의 근거는 **메모리 수명과 GC를 포함한 구조 수준의 원인 검토**를 지지한다. 엔진 전체 폐기, Hermes/GC의 단독 책임, GC 설정 조정이나 V8 전환만으로의 해결까지 입증하지는 않는다. 이번 개정은 코드·기존 기록·공식 자료 검토로 `report.md`만 수정했으며, runtime 설정 변경·빌드·신규 성능 테스트는 하지 않았다.
