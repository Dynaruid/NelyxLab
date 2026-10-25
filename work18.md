# W18: Nelyx 기반 개편 — TypeScript UI Runtime·공통 Engine·플랫폼 Host 재설계

작성일: **2026-10-25 KST** · 주 수락 대상: **Windows x64 Release / Hermes bytecode·Static Hermes / 실제 Testbed 앱**

> **실행 PAUSED · 구현 PARTIAL · 제품 PARTIAL · performanceAccepted=false · physicalInputAccepted=notVerified · displayed=unobserved.** 2026-10-26 사용자의 “중간 마무리해줘” 요청으로 구현과 추가 native 검증을 중지했다. 현재 변경·검사 실패·공급 차이·재개 지점은 §8.4에 기록한다. Nelyx 기반 개편의 유일한 현행 계획은 이 문서이며, [W17](work17.md)은 **CLOSED / SUPERSEDED BY W18**이다.

**W18은 기존 구조의 작은 최적화를 이어 붙이는 작업이 아니라, Nelyx가 상태·트리·레이아웃·텍스트·scene·자원을 보유하고 갱신하는 기반을 다시 만드는 작업이다.** TypeScript로 앱과 Widget·State를 작성하는 제품 방향, Nelyx 자체 콘텐츠 레이아웃, Hermes 기본 엔진 방향은 유지한다. 내부 클래스 구조·저장 방식·모듈·native ABI·공급 방식은 교체할 수 있다. 기존 소스와 API를 모두 그대로 보존하는 것을 개편의 전제로 삼지 않는다.

주안은 **TypeScript에 맞춘 UI Runtime과 RN에 종속되지 않는 공통 Engine을 분리**하는 것이다. Widget/Element와 RenderObject의 서로 다른 역할은 유지하되, 내부의 중복 projection·전역 재탐색·반복 snapshot·동결·encode를 줄이고 실제 변경 단위로 갱신한다. native는 Skia·문단·자원·recording·GPU 작업을 소유한다. **layout 전체의 C++ 이전은 확정하지 않는다.** JS에서 실행해야 하는 사용자 builder·State·custom layout이 남으므로, 언어만 바꿔 경계 호출을 늘리는 설계는 별도 시제품에서 이득과 의미 보존을 확인한 범위만 채택한다.

## 0. W17 종료와 승계

W17 종료는 host 구현의 중간 결과를 보존하면서 실행 계획을 교체하는 결정이다. 버벅임·메모리 증가·물리 입력 문제가 해결됐다는 뜻이 아니다. W17 §1~8의 단계와 마지막 재개 지시는 역사적 자료로만 읽으며, W18 실행을 W17의 마지막 메모리 진단부터 강제로 시작하지 않는다.

| W17의 구현·미해결 | W18의 처리 |
|---|---|
| 직접 Hermes host, 전용 runtime thread, HWND/Composition, 입력·TSF/UIA, CLI 공급 | 재사용할 제품 기반. 다시 시제품 host를 만드는 단계로 되돌아가지 않고 공통 Engine/Host 경계를 정리한다. |
| display-list1의 23 opcode, bounded input, generation·GPU drain | 이미 있는 기능이다. 새 비용·수명 구조에 통합하며 출력·오류·retirement 계약을 보존한다. |
| cold/revisit/fast의 긴 프레임, 행 생성·layout·할당 비용 | W18의 주 개편 대상. cache/pool/retained 구조의 메모리 사용도 허용하고 실제 cold/revisit·입력/표시 효과를 검증한다. 샘플 축소·AOT coverage만으로 해결 처리하지 않는다. |
| process private commit 증가, driver residency 미확인 | 과거 수치·실패 기록은 보존하고 목적·owner·회수/재사용 정책을 조사한다. W17의 고정 상한·마지막 3회 plateau는 W18 구조 선택·수락의 필수 기준으로 승계하지 않는다. |
| RNW bytecode AV·과거 focus/종료 실패 | RNW 경로를 지원하는 동안 미해결 목록·회귀 대상으로 유지한다. 최종 지원 경로에서 명시적으로 퇴역하면 `RETIRED WITH PATH`로 구분하며 `FIXED`로 바꾸지 않는다. |
| H0~H5 및 물리 한글 IME·reader·content-to-display 미수락 | §6의 새 수락 기준으로 전량 대응한다. rendering-only·정적 검사·AOT coverage PASS를 제품 수락으로 승격하지 않는다. |
| prototype cache VM 포크 미채택 | 원복된 상태를 기준으로 시작한다. 새 근거 없이 같은 포크·비교 matrix를 반복하지 않는다. |

[W16](work16.md) 이하 계획을 재개하지 않는다. [W14](work14.md)의 엔진 관련 잔여는 이 계획에 필요한 범위에서 재평가하고, 별도 디자인 family 확장은 계속 보류한다. [W15A](work15a.md)의 과거 AOT 결과는 해당 공급·범위의 증거다. W18의 새 Core·번들·native image에는 다시 qualification이 필요하다.

## 1. 현재 구조 검토

### 1.1 확인한 소스와 기존 결과

이번 작성의 HEAD는 `d565971cfa0d1187792aa5b9cee3ff15f3dded9c`다. 시작 dirty는 **빈 `work18.md`만 untracked**였으며 추적 소스 변경은 없었다. 종료 문구 반영 전 W17 SHA-256은 `2a6a742c230a1a9a0f06653a0d08ddfc12c80db74d82474072ec481fff7038b2`다. 아래 실행 수치는 W17·[research.md](research.md)에 남은 과거 진단이며 이번 문서 작업의 신규 측정값이 아니다. 설치본 전체·loaded image·외부 toolchain은 이번에 다시 수락하지 않았다.

| 확인 지점 | 확인한 사실 | 개편 판단 |
|---|---|---|
| [`framework.ts`](Nelyx/src/framework/widgets/framework.ts), [`root.ts`](Nelyx/src/framework/widgets/root.ts) | Element가 상태·의존성·수명을, RenderObject가 layout을 맡는다. render child의 insert/move/remove와 queued build 뒤 projection/sync 경로가 함께 있다. inherited index는 일부 지점에서 Map을 복사한다. | 역할 분리 자체는 유효하다. 중복된 자료·정규화 작업의 필요성을 재검토하고 변경을 owner별로 한 번 반영하는 구조로 바꾼다. 현재 모든 sync가 불필요하다고 단정하지 않는다. |
| [`sliver.ts`](Nelyx/src/framework/widgets/sliver.ts), [`object.ts`](Nelyx/src/framework/rendering/object.ts) | lazy child의 builder·mount·하위 build가 layout callback 안에서 동기 실행된다. 기존 child store·dirty queue·0/1/N 최적화도 이미 있다. | 새 행의 원가를 줄여야 한다. scheduler나 GPU 비동기화만으로 동기 builder 실행 중간을 분할할 수 없다. |
| [`text-painter.ts`](Nelyx/src/framework/painting/text-painter.ts), [`text-layout-cache.ts`](Nelyx/src/hosting/text-layout-cache.ts) | 문단·측정·query 수명과 cache가 이미 있으며 스타일·입력·출력 snapshot이 여러 계층을 지난다. | canonical text/style 입력과 문단 owner를 통합하고, 필요한 cache·사전 준비도 비용/효과에 따라 선택한다. 실제 shaping 비용과 JS 준비 비용을 분리한다. |
| [`renderer.ts`](Nelyx/skia/packages/native/src/renderer.ts), [`display-list.ts`](Nelyx/skia/packages/native/src/display-list.ts) | native display-list 경로에서도 Core PaintFrame을 `replayFrame`이 방문하고 batch canvas가 native packet을 만든다. renderer는 최대 2개 in-flight lease를 관리한다. W18 착수 후 중립 TS 구현을 RN package에서 현재 링크로 이전했다. | JS 명령 객체→snapshot→renderer 방문→packet의 중간 표현을 줄인다. 이미 비동기인 GPU 제출을 다시 비동기화하는 계획은 반복하지 않는다. |
| [`native-hermes/application.ts`](Nelyx/sdk/src/backends/native-hermes/application.ts), [`CMakeLists.txt`](Nelyx/sdk/native/windows-hermes/CMakeLists.txt) | 직접 host가 RN 이름의 asset·interaction·frame-clock helper와 `@nelyx/skia-rn`의 renderer/JSI 구현을 재사용한다. CMake도 RN 패키지 안의 소스를 컴파일한다. | 이름만으로 RN runtime 의존성을 판정하지 않는다. 실제 중립 구현을 공통 owner로 추출하고 RN adapter가 이를 소비하게 의존 방향을 바꾼다. |
| [`globals.ts`](Nelyx/sdk/src/backends/native-hermes/globals.ts), [`bridge.ts`](Nelyx/sdk/src/backends/native-hermes/bridge.ts) | timer·frame·Promise rejection·console을 설치하며 global host ABI 1을 사용한다. 다양한 서비스 packet과 callback을 하나의 bridge가 연결한다. | 앱별 runtime 설치·오류·종료 계약, 기능별 ABI·capability를 명시한다. global shim을 늘리는 방식에서 명시적 runtime 조립으로 전환한다. |
| W17 §8의 행 생성 진단 | 한 행 74 Elements, 최악 fast frame 1,110 mount/1,036 unmount 및 긴 layout 구간이 기록돼 있다. 별도 GC 진단의 fast도 두 모드 모두 50ms를 크게 넘었다. | 단일 getter·closure 개선보다 생성되는 내부 구조와 갱신 경로를 우선 바꿀 이유다. 과거 inclusive span·PC 횟수를 현재 self CPU 시간으로 해석하지 않는다. |
| W17 §8의 메모리 진단 | 마지막 3회 private commit 순증가 2,347,008 bytes로 고정 1MiB 한계에 실패했다. 같은 표본의 Vulkan 할당·VM capacity는 일정했다. | JS heap·Skia·UIA·allocator·OS/driver 중 어느 owner인지 분리해야 한다. private 증가를 GC leak 또는 driver leak으로 확정하지 않는다. |

### 1.2 기존 방향의 한계와 새 결정

Flutter의 Widget/Element/RenderObject 구분은 역할 모델로 유지할 가치가 있다. 그러나 Flutter는 작은 노드의 대량 합성을 위해 증분 build/layout·reconciliation·자료구조 최적화를 함께 설계한다. **Dart 클래스와 방어용 adapter를 TypeScript에 옮겼다는 사실이 같은 실행 비용을 보장하지 않는다.** 이는 원본 설계와 현재 Nelyx 경로를 대조한 설계 판단이다. [Flutter 구조](https://docs.flutter.dev/resources/architectural-overview), [Inside Flutter](https://docs.flutter.dev/resources/inside-flutter).

일반 TypeScript의 타입 표기는 JS 출력에서 제거된다. 따라서 `readonly`, 타입 주석의 확대 또는 전체 앱 AOT라는 분류만으로 내부 객체가 고정 native record가 된다고 가정하지 않는다. W18은 실제 allocation·property access·경계 호출·전체 frame을 기준으로 자료구조를 선택한다. [TypeScript의 타입 제거](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types).

## 2. 대안 검토와 채택 범위

| 대안 | 평가 | 결정 |
|---|---|---|
| 기존 클래스·adapter를 유지하고 작은 할당 최적화만 누적 | 위험은 작지만 반복되는 구조 생성·표현 변환을 남긴다. | W18의 주안으로 채택하지 않음. 회귀 수정·전환 중 필요한 보완에 사용. |
| **TS UI Runtime 재설계 + 공통 native Engine** | 앱·사용자 callback은 같은 VM에 두고, 내부 자료·dirty 처리·text/scene/resource 경계를 바꿀 수 있다. Web과 native의 UI 의미도 공유한다. | **주안.** Nelyx 소유 제품 소스에서 구현하며 내부 호환을 위한 중복 engine을 상시 유지하지 않음. |
| Widget/Element/layout 전체 C++ 이전 | 사용자 builder·custom layout·State·Inherited 조회를 JS로 재진입해야 한다. native 노드별 wrapper와 Web/WASM 비용이 새로 생길 수 있다. | 전면 이전은 보류. §3.4의 순수 kernel만 비용 비교 후 선택. native layout만 옮겨 JS build 원가가 사라진다고 주장하지 않음. |
| Dart/Flutter engine을 제품의 실제 UI Runtime으로 교체 | TypeScript UI framework라는 제품 범위와 앱·도구·배포 모델을 바꾼다. | 이번 계획 밖. Flutter는 의미·알고리즘 참고 원본으로 사용. |
| React/Fabric/Yoga로 콘텐츠 layout 재위임 | Nelyx의 UI 소유권과 직접 host 방향을 다시 뒤집는다. | 채택하지 않음. RN은 필요한 이행·플랫폼 adapter 역할로 한정. |
| 새 TS→native compiler·전면 typed AOT·VM 포크를 먼저 구축 | compiler 범위가 개편을 지배하고 중복 작업량 자체는 남는다. | 선행조건에서 제외. 현재 Hermes 두 모드의 실행·타입 정책은 유지. |

**깨뜨릴 수 있는 계약:** 내부 클래스 상속·private 필드·facade·native packet ABI·빌드 내부 경로, 불필요한 legacy helper. 공개 API 변경도 필요한 경우 허용하되 §4의 같은 단계에서 실제 앱·디자인 패키지·템플릿·사용법을 함께 이전한다.

**보존할 제품 의미:** TypeScript 앱/Widget/State, Key에 따른 상태 식별, 사용자 builder와 lifecycle의 정의된 순서, Nelyx constraints/layout·hit test·scroll, 편집/접근성, 명시적 자원 수명. 관찰 가능한 의미를 바꾸려면 변경 전후 사례·새 계약·이전 방법을 적고 관련 회귀를 갱신한다. 내부 성능 개선이라는 이유로 조용히 제거하지 않는다.

## 3. 목표 기반

### 3.1 계층과 최종 소유권

| 계층 | 소유할 것 | 의존 경계 |
|---|---|---|
| 앱·Material/Cupertino | 화면 구성·사용자 상태·테마·control의 동작 | Core의 공개 직접 subpath. host·JSI·Skia native 객체를 조립하지 않음. |
| **TS UI Runtime / Core** | Widget·State·Element 식별, dependency graph, reconciliation, RenderObject layout·hit test·gesture/physics, 논리 semantics | OS/RN 타입 없이 동작. 공통 Engine port를 통해 text·scene·resource를 사용. |
| **Engine 계약 / Core `ui`·`hosting`** | versioned frame/text/resource/geometry 계약, owner·generation·lease | renderer가 소비하는 자료의 단일 정의. SDK·Skia가 같은 자료를 다시 별도 모델로 복제하지 않음. |
| **공통 native Engine / Skia** | paragraph·font/image/path/picture·recording·GPU 제출/retirement, 선택된 순수 kernel | RN·HWND·UIKit·JSI header를 공통 Engine 계약에 노출하지 않음. JS binding과 OS GPU adapter는 별도. |
| **SDK Runtime / Host adapter** | VM/event loop·clock·surface·입력·편집·접근성·OS 서비스·AppSession 조립 | Windows direct Hermes, RN 이행 경로, Web의 동일 port 구현. Core tree를 host UI tree로 재구성하지 않음. |
| **Tooling / 공급** | target별 pin·compiler·ABI·asset·package closure·실제 설치 검증 | 소스와 현재 공급이 일치해야 실행. 제품 runtime은 변환기·개발 기록 파일에 의존하지 않음. |

native Engine은 새 UI tree의 두 번째 owner가 아니다. **Element 상태의 기준은 TS Runtime, layout geometry의 기준은 해당 RenderObject owner, GPU 자원의 기준은 native Engine**으로 하나씩 둔다. JS/native 양쪽이 같은 mutable layout 상태를 독립 수정하는 구성을 만들지 않는다.

### 3.2 내부 데이터·식별·불변성 재설계

- hot 상태는 owner가 가진 안정된 record에 모은다. tree link·dirty flags·revision·dependency·geometry를 별도 adapter 객체마다 복사하지 않는다. public class가 필요한 곳은 같은 record를 바라보는 API로 만들고, class 필드와 record를 동시에 mutable 기준으로 두지 않는다.
- `slot + generation` 식별과 제한된 arena/free-list는 수명이 짧은 **내부 record**에만 검토한다. 숫자 범위·slot 재사용·generation overflow·stale callback 거부를 정의한다. Widget·State·Element·controller의 사용자 관찰 identity를 pool로 재사용하지 않는다.
- 작은 cardinality는 기존 0/1/N 구조를 재사용한다. TypedArray는 숫자 자료가 연속이고 실제 이득이 있는 경로에만 쓴다. 모든 Map/Set을 배열로 바꾸거나 global registry를 추가하는 것을 목표로 삼지 않는다.
- 외부 mutable 입력을 받는 경계에서 소유 snapshot을 만들고 이후 단계는 revision/handle로 참조한다. API에 노출한 snapshot은 계속 불변이다. `readonly`를 runtime 불변성의 증거로 사용하지 않는다.
- Nelyx가 직접 만든 record에만 빠른 내부 경로를 적용한다. 사용자 getter·Proxy·iterator·subclass는 정의된 호출 순서·receiver·오류 의미를 보존하는 일반 경로를 사용한다. 판별 과정에서 사용자 코드를 예상 밖으로 실행하지 않는다.
- Release에서도 bounds·owner/generation·교차 thread·폐기 후 접근·packet 검증·자원 한계는 유지한다. 제거 가능한 전체 tree 감사와 상세 진단만 검증 모드로 분리한다. assertion 삭제를 성능 수락으로 사용하지 않는다.

### 3.3 Widget/Element·dependency·reconciliation

- mount/update/move/deactivate/reactivate/unmount를 명시적 owner transaction으로 구성한다. 임시 위젯 목록·render projection·ParentData 재탐색을 줄이고 성공·예외 rollback 뒤 tree와 registry를 일관되게 남긴다. 사용자 lifecycle callback의 이미 발생한 부작용까지 되돌릴 수 있다고 가정하지 않는다.
- child slot 변경을 한 owner의 구조 변경으로 기록하고 render child 갱신에 직접 반영한다. queued sibling build·GlobalKey 이동 때문에 필요한 정규화는 해당 경계에서 한 번 수행한다. 모든 insert/move 뒤 전체 `setChildren`을 반복하는 이중 경로를 최종 구조에 남기지 않는다.
- inherited/theme/media dependency는 provider token·revision·aspect별 구독으로 관리한다. 모든 descendant의 Map 복사·상위 탐색을 기본 갱신 방식으로 삼지 않는다. 동적 type token·사용자 정의 Inherited·GlobalKey reparent는 느린 정확한 경로까지 포함한다.
- dirty element·layout·paint·semantics 큐는 실제 owner 변경에 따라 admission한다. 동일 노드 중복 처리, 매번 ancestor 전체 방문, 여러 계층의 동일 Set 검증을 줄이고 재진입·예외·detach 때 큐를 정확히 회수한다.
- Material/Cupertino 내부의 순수 포장과 반복 style 조립은 직접 record/primitive 조합으로 줄일 수 있다. Key·BuildContext 조회·State·Inherited·notification·semantics·focus의 관찰 경계가 있는 wrapper는 임의로 없애지 않는다. 단순히 Elements 수를 줄인 것을 성공으로 수락하지 않는다.

### 3.4 layout·Sliver·확장 지점

- constraints·parent dependency·dirty boundary·geometry revision을 기준으로 증분 layout을 재구성한다. paint-only·transform-only·scroll-only 갱신이 실제로 필요한 branch만 거치게 한다. text·semantics·hit test가 같은 geometry commit을 참조하게 한다.
- lazy child 생성·퇴장·extent 보정·anchor·keep-alive를 한 owner 경계에서 관리한다. 고정 extent far-seek는 목적지 범위만, 가변 extent는 측정 결과와 anchor를 반영한다. 현재의 bounded 범위·상태 유지 의미를 보존한다.
- 사용자 builder·lifecycle·custom layout 한 번의 실행은 동기적이다. frame budget을 이유로 중간에 preempt하거나 다른 thread/VM에서 실행하지 않는다. 미리 준비할 수 있는 순수 자료·자원과 사용자 callback 실행을 구분한다.
- **cache/prefetch/keep-alive 예산은 Nelyx의 구조와 부하에 맞춰 변경할 수 있다.** 각 정책의 목적·보유 bytes/count·수명과 실제 cold/revisit·fast/far 비용을 함께 비교한다. 아직 생성하지 않은 목적지와 기존 데이터를 재사용하는 이동을 구분하며, 모든 행 보존을 포함한 전략도 실제 메모리·시작 비용과 규모별 동작을 평가한다. gallery 축소·cold를 warm으로 바꾸는 표본 대체는 허용하지 않는다.
- native kernel 후보는 대량 숫자 geometry·extent 탐색·순수 layout 계산처럼 입출력 경계가 닫힌 연산이다. JS→native 준비·copy·검증·결과 소비를 포함해 비교한다. custom callback마다 재진입하거나 노드마다 HostObject를 만드는 후보는 채택하지 않는다.
- kernel을 채택하면 native와 Web의 의미를 함께 제공한다. WASM을 쓰는 경우 memory/view 수명·성장·호출 비용을 검증하고 CanvasKit과 별개 모듈의 pointer를 공유하지 않는다. JS fallback을 쓰면 명시적 capability와 동등한 동작을 제공한다. 이득이 없으면 kernel 분기만 제외하고 TS Runtime 개편은 계속한다.
- `LayoutBuilder`·custom RenderObject·CustomPainter·ParentData·intrinsic/baseline·transform/hit test의 현재 지원 계약을 이전한다. 현재 미지원인 기능을 이번 작업으로 모두 새로 구현한다는 뜻은 아니다. 기존 지원을 숨은 fallback이나 기능 축소로 대체하지 않는다.

### 3.5 text·style·font·paragraph

- text content/run style/paragraph style/font catalog/locale/direction/scaler/width를 명시적 revision과 소유 descriptor로 정규화한다. 동일 입력을 TextPainter·hosting cache·backend가 각각 깊게 복사·동결·key 생성하지 않게 한다.
- native paragraph는 한 resource owner가 layout·paint·query lease를 관리한다. caret/selection/range geometry를 같은 문단 revision에서 얻는다. 이전 문단을 교체할 때 제출된 frame·UIA read가 끝나기 전 해제하지 않는다.
- text 측정의 동기 의존은 숨기지 않는다. 순서를 바꾸지 않는 독립 request만 batch할 수 있으며, 부모 constraints에 의존하는 layout을 무조건 비동기로 바꾸지 않는다.
- metric-only·paint-only 변경, 폰트/폭/theme/DPI/locale 변경의 무효화를 분리한다. 한국어·RTL·혼합 run·emoji·fallback font·가변 scaler·mutable Paint와 사용자 getter를 포함한다.
- cache의 resident bytes·entry·live lease와 축소/폐기 정책을 owner가 관리한다. 기존 cache 예산을 동결하지 않으며 필요한 문단·style 자료의 추가 보유를 허용한다. shaping의 실제 CPU, JS 입력 준비, hit 후 재사용 비용을 따로 본다. cache hit만으로 subtree 생성 비용이 해결됐다고 보고하지 않는다.

### 3.6 scene·geometry·입력·semantics commit

- Core paint recording에서 renderer가 직접 소비할 수 있는 소유 command buffer/retained chunk를 만든다. 기본 native 경로에서 PaintCommand 객체 배열→deep freeze→전 명령 replay→display-list 재encode를 반복하지 않도록 중간 표현을 통합한다. public custom paint 입력은 경계에서 검증·소유한다.
- style/path/paragraph/picture handle과 retained chunk를 revision으로 재사용한다. 모든 frame에 전체 scene을 직렬화하지 않는다. 한 번의 capture가 실패하면 이전 유효 scene·lease를 보존하며 부분 packet을 publish하지 않는다.
- visual·hit test·semantics·IME geometry에 같은 owner/tree/layout/viewport commit을 연결한다. 실제 공유 가능한 자료만 공유하고, UIA가 reader thread에서 읽는 immutable snapshot의 독립 수명은 유지한다. 의미가 다른 revision을 하나로 뭉쳐 모든 변경을 전체 무효화하지 않는다.
- 입력은 native 수신 sequence·원래 timestamp·부호/절대 거리·modifier·gesture 경계를 보존한다. down/up/cancel·key·IME·focus 경계는 합치거나 버리지 않는다. render 지연을 input 생략·offset 보정으로 감추지 않는다.
- runtime thread가 hit test·gesture/physics·State를 소유하고 UI thread는 OS packet·편집/접근성 endpoint를 소유한다. 이미 제출된 native frame의 retirement와 최신 scene 교체를 구분한다. GPU worker는 JSI value나 mutable TS tree를 보유하지 않는다.
- semantics는 stable ID·변경 delta·action revision을 유지한다. 접근성 on에서 검증하고 UIA query는 JS 동기 응답을 기다리지 않는다. geometry-only motion 갱신과 label/action/focus 변경을 구분하며 접근성 off를 제품 해결책으로 사용하지 않는다.

### 3.7 SDK Runtime·host·global 환경

- `AppSession → View → runtime/engine ports`의 생성·실패·종료 상태를 명시한다. 직접 host와 RN adapter가 각각 비슷한 자원 조립·close 함수를 복제하지 않도록 공통 composition owner를 만든다.
- clock/timer/microtask/frame callback·Promise rejection·error reporting·visibility/resume·환경/asset/service를 host port로 나눈다. boot 시 capability/ABI를 확인하고 없는 서비스는 초기에 명확하게 거부한다. 모든 브라우저/Node API의 거대한 호환층을 만들지 않는다.
- globals는 한 VM의 bootstrap에서 정해진 순서로 한 번 설치한다. monotonic time, timer 취소/종료 중 예약, microtask 예외와 rejection 처리, 순환 객체 console 출력·오류 경로를 제품 계약으로 검토한다. 현재 shim의 동작을 표준 구현 완료로 간주하지 않는다.
- Hermes와 JSI handle은 한 runtime thread가 소유한다. task 뒤 checkpoint·timer/frame/input 순서와 bounded wakeup을 명시한다. 외부 JSI ABI는 target별 adapter에 한정하고 공통 Engine ABI와 분리한다.
- close는 admission 중단→입력/서비스 callback 차단→frame/GPU drain→native/JS lease 반환→VM 파괴→창/OS 자원 해제의 실제 의존을 따른다. fatal/시작 실패/사용자 Close도 같은 owner 모델로 처리하며 process exit에 자원 회수를 떠넘기는 것을 정상 종료로 수락하지 않는다.
- Windows의 직접 Hermes host는 최종 주 경로다. 실제 기본 host 전환은 §6 통과 후에 한다. Windows 전용 HWND·TSF·UIA·Composition 타입은 공통 port에 노출하지 않고 iOS/Android가 구현 가능한 생명주기·편집·접근성 계약으로 둔다.

### 3.8 자원·메모리

- font/image/paragraph/path/picture/frame buffer/GPU surface/UIA peer/JS callback의 생성·보유·반환 owner를 구현과 연결한다. RAII/explicit dispose·lease·fence retirement를 정확성 근거로 사용하고 JS GC/finalizer는 보조 수단으로 한정한다.
- **Nelyx의 구조·성능·기능에 필요한 메모리 사용을 허용한다.** cache·pool·arena·retained scene·사전 계산·native 자료 보유를 기존 메모리 수치 때문에 배제하지 않는다. 추가 메모리의 목적·owner·실제 이득·보유 수명·축소/폐기 방법을 구현과 연결한다. 기존 최대 2개 in-flight는 현재 제출/지연 계약이며, 이를 바꾸려면 별도로 입력 지연·backpressure·retirement를 검증한다.
- memory 사용량과 할당량은 설계 판단에 필요한 측정값이다. VM live/capacity·native allocator·Skia·UIA/COM·Vulkan·process private와 cache/pool 보유를 구분한다. 입력 규모·테마·DPI·화면별 필요량과 같은 완료 작업량의 frame/GC 지연을 함께 보고하며 사용량 증가만으로 실패하지 않는다.
- W17의 **private 1GiB / Vulkan 512MiB**, 마지막 3회 span **8MiB / 1MiB**, 순증가 **1MiB / 64KiB**, allocation count 순증가 **0**은 **W18의 필수 수락 기준에서 퇴역**한다. 별도의 4MiB 대체 한계도 두지 않는다. 마지막 3회 증감은 원시 관측으로 남기며 plateau·누수 없음·driver residency의 자동 PASS를 만들지 않는다. 과거 실패를 수정 완료로 바꾸지 않는다.
- 자원 보유에는 설명 가능한 수명과 회수 정책이 있어야 한다. 종료된 owner의 lease/handle/callback 미반환, stale 접근, 목적·보유 정책으로 설명되지 않는 반복 누적, OOM/메모리 압박으로 인한 기능·응답·종료 실패를 검증한다. 의도한 cache/pool 보유와 미회수를 구분하고 필요 시 압박 대응·축소·allocation 실패 처리도 확인한다. 근거 있는 target별 제품 예산은 이후 실제 기기/부하에 맞춰 정할 수 있으며 임의의 전역 MB 상한을 설계의 선행조건으로 두지 않는다.

## 4. 소스·패키지·공급 이전

아래 경로·패키지는 목표 owner다. `src/runtime`의 첫 owner transaction·dependency scope를 구현 중이며 나머지 이전 상태는 §8에서 구분한다. W18-01에서 실제 import graph와 최소 export를 확인한다. 폴더 이름만 바꾸고 동일 adapter chain을 남기는 작업으로 완료 처리하지 않는다.

| 현재 owner | 목표 owner / 이전 조건 |
|---|---|
| `Nelyx/src/framework/**` | 공개 Widget/State/Element·RenderObject API와 알고리즘의 owner를 유지. hot record·dependency·transaction 공통 구현은 신규 `Nelyx/src/runtime/`에 모으되 공개 API와 동일 상태를 이중 저장하지 않음. 새 npm Runtime 패키지를 따로 늘리지는 않음. |
| `Nelyx/src/ui/**`, `Nelyx/src/hosting/**` | Engine port·frame/text/resource/geometry 계약의 단일 정의. 필요 없는 source형/transport형 중복을 정리하고 공개 view와 내부 소유 자료를 구분. |
| `Nelyx/skia/packages/rn` 안의 중립 renderer·text·resource·JSI 구현 | 신규 `Nelyx/skia/packages/native` / `@nelyx/skia-native`를 공통 native renderer/binding owner로 분리. `skia-rn`은 RN view/registry adapter와 이행 export만 유지. JSI 구현은 target cohort에 맞게 빌드하며 Engine 공통 header에 JSI를 전파하지 않음. |
| `Nelyx/skia/native/**` 및 RN package의 generated 복사본 | canonical C++ 구현은 `Nelyx/skia/native/`에 둠. platform GPU와 runtime binding을 분리하고 generated 파일은 현재 빌드의 파생 출력으로 한정. canonical 소스와 복사본을 따로 수정하지 않음. |
| `sdk/src/backends/react-native`의 중립 helper | `sdk/src/runtime` 또는 기능별 공통 서비스 owner로 추출. direct/native와 RN adapter가 공통 구현을 소비. 실제 RN module·view·dispatcher만 RN backend에 남김. |
| `sdk/native/windows-hermes`, `sdk/src/backends/native-hermes` | Windows embedder와 Hermes binding의 책임을 분리. 거대한 main/bridge가 engine 자료·UIA/IME·서비스·GPU 수명을 모두 직접 다루는 결합을 해소. |
| `packages/material`, `packages/cupertino`, 실제 sample·CLI template | 현재 사용 중인 control·style·theme를 새 Runtime에 이전. 전체 catalog·custom API 소비를 확인하고 같은 단계에서 breaking import/API와 사용법을 갱신. 신규 family 확장을 선행하지 않음. |
| `tools/Nelyx.FrameworkToTypeScript`의 provenance/ownership | 제품 소스를 개발 기준으로 사용. 필요한 adopt·출처·numeric annotation·license metadata만 정합화. 재생성이나 기능별 converter 확장을 제품 개편의 선행조건으로 만들지 않음. |

공개 package는 필요한 직접 subpath만 export하고 새 barrel/facade chain을 만들지 않는다. source·dist·타입·map·exports·package dependency closure·archive·설치·bundle/native image를 같은 단계에서 맞춘다. ABI가 바뀌면 version/capability를 갱신하고 오래된 host·DLL·bundle의 혼합 실행을 초기 거부한다.

호환 wrapper는 이전 중인 소비자가 있을 때만 한 방향으로 둔다. **마지막 소비자 이전과 함께 wrapper·옛 runtime 분기·중복 encode/registry를 제거**한다. 이전 runtime과 새 runtime을 두 제품처럼 영구 유지하지 않는다. baseline 재현에는 Git의 소스 identity와 필요한 현재 공급을 사용하고 전체 SDK/설치본의 사본을 계속 보관하지 않는다.

지원 경로와 퇴역 후보는 W18-01에서 먼저 정하고 W18-09/10에서 마지막 소비자 이전을 확인한다. 최종 R5는 **최종 공급에 포함할 모든 지원 경로**에 적용한다. RNW를 남기면 알려진 AV·종료 실패도 해결해야 한다. RNW 퇴역으로 범위를 바꾸려면 대체 경로의 기능·공급·기존 엔진 선택에 미치는 영향을 명시하고 소비자 이전을 끝내야 하며, 기본 host를 바꿨다는 사실만으로 퇴역 처리할 수 없다. W18-12는 이 결정을 새로 만들어 gate를 피하는 단계가 아니라 확인한 전환을 제품 기본값에 적용하는 단계다.

Hermes pin 업그레이드는 구조 변경과 분리한다. W17의 Windows source pin `94aa5e1d40a4ce99df79d951cbe45310ec40680c` 및 해당 compiler/runtime/JSI cohort를 착수 시 확인한다. Android의 별도 Hermes/HBC cohort와 섞지 않는다. bytecode·Static Hermes는 각각 qualification하며 기존 type policy·coverage·실행 audit을 새 출력에 맞춰 검증한다. V8/JSC의 명시적 선택은 지원을 종료하기 전까지 기존 adapter의 회귀 대상으로 유지한다.

## 5. 실행 단계와 의존 순서

작업 단위는 파일 수가 아니라 **한 owner/계약의 구현→실제 소비→옛 경로 제거**다. 각 단계의 최소 기능 회귀와 필요한 공급 확인을 끝낸 뒤 진행하며, 매 단계 전체 SDK·전체 native matrix를 반복하지 않는다. 단계별 실제 상태는 §8에서 관리한다.

| ID | 작업과 주요 산출물 | 단계 완료 조건 |
|---|---|---|
| **W18-00 현재 기준선·잔여 inventory** | HEAD/diff·source/dist/설치·toolchain/locator·실제 loaded identity와 기존 실패 목록 확인. 전체 catalog의 지원 동작·extension·자원 owner를 짧게 정리. 실행 불가능한 baseline만 우선 수리. | 이번 Nelyx로 비교 가능한 현재 공급 확보. 원인 진단/정규 비교/물리 수락 범위를 분리하고 기존 실패를 누락하지 않음. |
| **W18-01 Runtime/Engine 계약·이전 설계** | §3·4의 소유권·record·dependency·frame/text/resource ABI·thread/close 상태·API 변경표 확정. source import graph와 RN-neutral 추출 대상, 최종 지원/퇴역 후보 경로 확인. | 중복 mutable 기준·순환 의존·OS 타입 누출 없음. 기존 소비자마다 이전 단계가 있고 unsupported 기능·퇴역 영향이 명시됨. |
| **W18-02 최소 구조 시제품·선택** | 실제 ListTile/ListView·텍스트·semantics의 한 경로에 새 record/transaction·증분 갱신을 적용. 현재 직접 host에서 두 Hermes 모드 비교. 필요한 순수 native kernel만 작은 대조로 검토. | builder/State/Key·출력·입력 의미를 보존한 실제 경로. §5.1의 구조·비용 목표로 자료구조를 선택하고 미채택 후보는 제거. |
| **W18-03 Element·dependency·수명 교체** | 새 child/dependency/dirty 소유권과 transaction 구현. reconciliation·Inherited·GlobalKey·ParentData·detach/rollback을 이전. | 상태·callback 순서·오류 후 tree/registry 일관성 회귀 통과. 해당 소비자의 중복 projection/sync와 이전 record owner 제거. |
| **W18-04 RenderObject·layout·Sliver 교체** | 새 dirty boundary·geometry commit·extent/anchor·lazy child 생성/퇴장. custom layout/paint 확장점 연결. | fixed/variable extent·far-seek·역방향·resize/RTL·keep-alive·hit test/scroll 의미 보존. 선택한 보유 정책의 메모리와 cold/revisit 비용을 함께 평가. |
| **W18-05 text/style·paragraph owner 통합** | canonical descriptor·폰트 revision·paragraph/query/paint lease·bounded cache. metric/paint-only 변경과 편집 geometry 연결. | 한국어/RTL/run/fallback/scaler·caret/selection·교체/retirement 동등. 반복 snapshot과 중복 key 변환 제거, 잔여 shaping 비용 구분. |
| **W18-06 공통 native Engine·scene 경로 교체** | 공통 `skia-native`·canonical native target 추출. Core recording→native/Web adapter의 직접 소비와 retained chunk·packet ABI 구현. | 현재 paint/clip/effect/paragraph/picture 출력·오류·lease 동등. default 경로의 이중 replay/encode 제거, 제한·generation·GPU drain 유지. |
| **W18-07 입력·편집·semantics commit 통합** | 같은 geometry commit의 input/hit/UIA/IME 연결, focus/selection/action·snapshot retirement. | 입력량·순서·capture/cancel·physics·텍스트 상태 보존. stale owner/revision 거부, 접근성 on의 자동 기능 회귀. 물리 수락은 별도 유지. |
| **W18-08 SDK Runtime·host 조립 개편** | 공통 bootstrap/close·서비스 port·globals/capability·VM owner와 Windows embedder 분리. RN/Web adapter 연결. | RN runtime 없이 직접 host 시작·재개·실패·정상 close. timer/microtask/오류 경계·loaded identity·OS 자원 소유 확인. |
| **W18-09 실제 디자인 패키지·앱/API 이전** | Material/Cupertino의 현재 전체 catalog, sample·template·custom API 소비를 새 기반으로 이전. 필요한 API/import 변경과 문서 반영. | 작은 fixture 외에 실제 Testbed 전체 동작. 테마·navigation/dialog/overlay·focus·편집·State 보존. 마지막 소비자의 호환 wrapper 제거. |
| **W18-10 현재 제품 공급·플랫폼 회귀** | 새 package closure·source→dist→설치→bundle/HBC/AOT/EXE/DLL 일치. 실제 앱의 두 Hermes 모드, 영향받은 Web/Android 검증. | 이전 ABI/locator/변조 공급 거부. 현재 설치본의 실행·응답·종료 확인. 플랫폼별 확인/미확인 경계를 README에 반영. |
| **W18-11 최종 성능·메모리·물리 수락** | §6의 동일 부하 비교, 메모리 목적·보유 정책·owner 회수/압박 대응 확인, 실제 표시·precision/IME/reader 검증. | 각 모드·창·화면·phase별 판정. 미관측/실패를 유지하며 필수 미달 시 전체 PARTIAL. |
| **W18-12 기본 전환·퇴역·정리** | 수락된 경로를 CLI/template/launcher 기본값으로 전환. 앞서 정한 지원/퇴역 결정을 실제 소비자 이전·공급 결과와 대조하고 미사용 분기·wrapper·출력 정리. | 지원하는 경로의 필수 실패 0, 사용법과 실제 기본값 일치. 퇴역/미채택과 해결을 구분하고 활성 구현 owner가 하나임. |

주 의존 순서는 **00 → 01 → 02 → 03 → 04/05 → 06 → 07/08 → 09 → 10 → 11 → 12**다. text·Engine의 경계 추출, 메모리 owner 조사 등 독립 작업은 관련 계약 확정 후 진행할 수 있다. W17 메모리 plateau나 최종 physical gate를 모든 구조 개편의 선행조건으로 삼지 않는다.

### 5.1 시제품의 결정 기준

W18-02는 완전한 새 engine을 만든 뒤 평가하는 단계가 아니다. 실제 앱의 대표 행/목적지 생성 경로와 동일한 의미를 사용하는 작은 구현에서 **생성·구조 변경·style/text 준비·layout·paint 준비**의 원가를 함께 확인한다. 단순 도형·scalar benchmark만으로 채택하지 않는다.

설계 검증 목표는 동일 부하의 cold/revisit에서 **frame CPU wall p95 25% 이상 감소**, retained p95의 **10% 초과 악화 없음**과 출력·입력·자원 수명 보존이다. **동일 완료 작업량당 VM 할당 30% 감소는 참고 목표로 전환하며 채택의 필수 조건으로 두지 않는다.** 할당·resident 메모리가 증가하더라도 필요한 구조와 실제 frame/GC·입력 지연의 이득, 보유·회수 정책이 검증되면 채택할 수 있다. frame 수가 다른 phase의 총 할당량을 그대로 개선율로 쓰지 않으며 최종 §6 수락은 별도다.

기능을 보존해도 비용 목표에 못 미치면 원인을 분해해 record 배치·갱신 경계·cache/pool·native kernel 중 필요한 선택을 바꾼다. 메모리 보유 정책을 바꾼 후보는 실제 구현 변경으로 구분하고 변경 전후 부하·resident 비용·회수 정책을 명시한다. 측정 조건 변경·강제 GC·샘플 축소로 개선을 꾸미지 않는다. 근거 없는 후보를 제거하고 설계를 고친 뒤 다음 단계로 진행한다. 시제품 목표를 이유로 수백 회 비교하거나 이미 알려진 W17 문제만 반복 조사하지 않는다.

## 6. 검증과 최종 수락

### 6.1 제한된 검증 정책

- 저장소 [copilot 지침](.github/copilot-instructions.md)을 따른다. **테스트 timeout은 20분(1,200,000ms)**이며 native/UI 검증도 전체 실행 deadline과 orderly 종료·정리 경로를 가진다. 무한 재시도하지 않는다.
- 일반 비교는 조건당 3회부터 시작하고 한 검증 묶음의 반복은 대부분 30회 안에서 끝낸다. 시제품은 대표 창에서 **기준/후보 × 2모드 × 3회 = 12회**, 최종 비교는 **기준/후보 × 2모드 × 2창 × 3회 = 24회**가 기본 상한 구성이다. 같은 공급의 유효한 결과를 이유 없이 다시 만들지 않는다.
- 기준/후보는 monitor·실제 viewport/DPI·refresh·접근성·asset/font·cache budget·앱 데이터·입력 경로/양·계측 조건을 맞춘다. 구현 중간의 진단 수치를 최종 baseline과 합치지 않는다. Debug·Node·profiling 결과는 원인 분석용이다.
- 실제 앱은 **`sample/nelyx-testbed-app-2` 하나**다. bytecode·Static Hermes는 두 실행 모드이며 추가 제품 앱·독립 설치본의 누적 보관을 요구하지 않는다. catalog를 축소하거나 별도 빠른 화면으로 바꾸지 않는다.
- workload는 일반 고정 extent list와 실제 Material/Cupertino 가변 section gallery의 **cold 진입·역방향 revisit·retained 이동·fast/far 이동·resize/DPI·theme/font 변화**를 포함한다. mount/unmount 0인 warm 왕복만으로 수락하지 않는다.
- OS 수신→Core 처리→offset/내용 변화→matching surface를 sequence로 확인한다. 합쳐진 이벤트 수도 원래 부호/절대량·경계를 보존해야 한다. foreground 상실·거리 불일치·누락/중복·시나리오 미완료 표본은 폐기하고 실패 원인을 남긴다.
- build·CPU profile·메모리 상세 진단을 정규 입력/표시 비교와 동시에 실행하지 않는다. CPU wall, OS thread CPU, GC pause, GPU 완료, compositor 제안, 실제 표시를 서로 다른 지표로 보고한다.

착수 후 변경 범위에 맞춰 기존 `npm.cmd run test:scroll-engine`, `test:layout-constraints`, `test:paint-recording`, `test:native-paint-replay`, `test:editable-renderer`, `test:windows-semantics`, `test:native-hermes`를 선택한다. C++ host·package boundary·type check도 해당 계층을 바꿨을 때 실행한다. 이 명령들은 현재 저장소의 회귀 진입점이며, 새 Runtime의 동작 검사는 필요한 상태/경계 사례에 맞춰 보완한다. 이번 문서 작업에서는 실행하지 않았다.

### 6.2 필수 gate

`B = 1000 / 실제 대상 refreshHz` ms다. 60Hz뿐 아니라 현재 대상 display mode의 예산으로 판정한다. 명목 주사율 조회는 실제 content 표시 계측을 대신하지 않는다.

| Gate | 완료 기준 | W17 대응 |
|---|---|---|
| **R0 구조·실제 경로** | 새 owner/record·dependency·text/scene/resource 경로를 실제 앱이 소비. 불필요한 옛 sync/replay/encode·순환 의존·중복 mutable owner 제거. 직접 host의 runtime/link/loaded 경로에 RN renderer/Fabric/Yoga·Node-API JSI adapter 의존 없음. RN 이름의 폴더 유무만으로 판정하지 않음. | H0 |
| **R1 상태·기능·정확성** | 전체 기존 catalog, State/Key/GlobalKey·Inherited·ParentData·예외 rollback·custom 확장·constraints/RTL/resize·scroll/gesture·navigation/overlay·text/focus/IME/UIA action 동등. 접근성 on, 입력 거리/순서/경계 보존. | H1 |
| **R2 render·자원 계약** | paint/effect/text 출력과 generation·frame admission·lease·GPU retirement 동등. malformed/stale/oversize packet은 mutation/publish 전에 거부. 숨은 legacy renderer·AOT/bytecode fallback으로 수락하지 않음. | H0/H4 |
| **R3 frame·입력 지연** | **각 Hermes 모드·창·화면·phase별** CPU wall p95≤0.75B, p99≤B, max<50ms. oldest input→matching surface p95≤2B, max<50ms. 같은 부하 baseline 대비 변화와 표본 수를 함께 보고. | H2 |
| **R4 실제 표시·물리 입력** | matching content 표시 간격 p95≤1.25B, p99≤2B, 50ms 이상 새 화면 정지 0회, 1.5B 초과 간격 연속 3회 0회. oldest input→display p95≤3B/max<100ms. precision contact/관성/재접촉/반전·wheel 및 실제 한글 IME/reader 확인. | H3 및 H1 물리 범위 |
| **R5 메모리·안정성·종료** | §3.8의 메모리 목적·보유/축소 정책·owner 회수 확인. 의도한 보유와 미회수/지속 누적을 구분하고 OOM/압박 대응을 검증. 지원 대상의 원인 미확정 AV·종료 실패 없음. close/drain·late callback·UIA peer·VM 파괴 경계 통과, 정상 exit0/강제 종료 없음. 전역 bytes/짧은 plateau 수치로 자동 판정하지 않으며 driver residency는 관측 범위 별도 표기. | H4 |
| **R6 공급·회귀** | source→dist→package→설치→bundle/HBC/AOT→EXE/DLL loaded identity 일치. 실제 앱 두 모드의 정상 시작·응답·종료, CLI doctor/prepare/build/run/pack과 template·README의 계약 일치. | H5 |
| **R7 플랫폼·퇴역** | 공통 변경을 소비하는 현재 Web/Android 경로에서 기능·공급 회귀 확인. iOS/macOS/Linux는 source/contract와 실제 native 수락을 분리. 이전 경로의 마지막 소비자 이전 및 지원/퇴역 범위 명시. | H5 및 W18 구조 범위 |

`architectureAccepted / engineAccepted / performanceAccepted / memoryAccepted / physicalInputAccepted / platformAccepted`를 구분한다. 모든 필수 gate가 닫히기 전 제품 전체는 **PARTIAL**이다. 표시를 관측하지 못했으면 `displayed=unobserved`, 물리 확인이 없으면 `notVerified`를 유지한다. 물리 검증이 미완료여도 독립 구현은 진행할 수 있으나 실제 기본 host 전환·문제 해결 완료 판정에는 사용할 수 없다.

Windows가 1차 제품 수락 범위다. Web·Android의 현재 기능을 새 Core 때문에 깨뜨린 상태로 종료할 수 없다. iOS/macOS/Linux 전체 embedder 구현·기기/서명 수락은 이 계획의 완료 조건으로 새로 추가하지 않으며, 공통 계약의 타 플랫폼 구현 가능성과 현재 source 통합은 검토한다. Windows Static Hermes의 성공을 iOS AOT 지원 완료로 해석하지 않는다.

### 6.3 기록·출력 정리

현재 계획·짧은 진행 상태·잔여 작업은 **이 루트 `work18.md`**, 제품 사용법은 기존 README에 기록한다. 검증 로그·immutable receipt·checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile을 누적하지 않는다. `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`는 생성·복구·출력 경로로 사용하지 않는다.

임시는 한 실행에 필요한 것만 만들고 성공·실패·중단 시 `finally`에서 삭제한다. 현재 dist와 필요한 현재 공급/cache만 남기고 교체 전 dist·staging·`last-sdk-*`·자동 타 드라이브 archive는 남기지 않는다. 삭제는 작업 소유·해결된 절대 경로가 workspace/지정 임시 root 안인지 확인하고 진행한다. 현재 제품에 필요한 manifest/locator는 실행 계약이며 과거 검증 기록을 쌓는 용도로 확장하지 않는다.

## 7. 주요 위험과 설계 한계

| 위험 | 대응 / 중단 기준 |
|---|---|
| TS build 원가를 남긴 채 native wrapper만 증가 | 전체 경계 비용을 포함하는 W18-02에서 판정. kernel 미채택은 가능하며 전체 C++ 재작성으로 자동 확대하지 않음. |
| compact record·pool이 State identity·callback 수명을 훼손 | 내부 storage만 재사용하고 generation·dispose·외부 참조 수명을 검증. 사용자 객체 재사용으로 비용을 줄이지 않음. |
| wrapper 축소가 context·getter·Inherited·semantics 의미를 바꿈 | 관찰 경계가 증명된 내부 순수 조합만 축소. 임의 사용자 객체와 custom 확장에는 일반 경로 보존. |
| transaction이 rollback 가능한 범위를 과장 | tree/registry/lease 불변식과 사용자 callback 부작용을 분리. 오류 중 추가 오류도 owner를 잃지 않게 처리. |
| direct host가 RN 코드를 이름만 바꿔 계속 내장 | import/link/loaded/call path와 실제 공통 owner로 확인. 정식 Engine의 dependency closure에 RN 초기화가 필요하면 미완료. |
| retained chunk·paragraph·UIA snapshot이 메모리를 보유 | bytes/count·read/frame lease·retirement와 close를 관찰하고 보유/축소 정책과 연결. W17의 증가 관측은 owner 근거로 조사하며 옛 수치 한계를 새 구조에 강제하지 않음. |
| Web/WASM가 별도 engine 또는 copy-heavy 경로가 됨 | 공통 TS UI 의미와 Engine port 유지. WASM 채택 시 해당 build/메모리/브리지 비용까지 평가. 채택 안 한 kernel에 Web 바이너리를 추가하지 않음. |
| 지원 플랫폼/기능을 줄여 성능만 수락 | 실제 catalog·접근성 on·동일 부하, 플랫폼별 기능·회귀와 표시 수락을 분리. 퇴역 경로는 이유/소비자/대체를 명시. |

## 8. 현재 상태와 다음 시작점

| 항목 | 현재 상태 |
|---|---|
| W17 실행 계획 | **CLOSED / SUPERSEDED BY W18**. 종료 시 구현·제품 결과는 PARTIAL이며 실패·미확인 범위 유지. |
| W18 계획 | **PAUSED**. 2026-10-26 사용자 중간 마무리 요청. 완료·수락으로 판정하지 않음. |
| W18-00 | **PARTIAL**. 착수 HEAD `db27ecedd2c38e38c16753fa827c9b0cab77c911`, dirty 없음. 현재 공급·실행 기준선 확인 중. |
| W18-01 | **PARTIAL**. 아래 첫 owner/소비자 계약 확정. 공통 native 패키지·scene/text ABI 이전 설계는 계속 필요. |
| W18-02 | **PAUSED / PARTIAL**. render owner commit·공유 dependency·intrusive dirty queue·text/semantics 준비와 Icon render primitive 시제품. 비용 목표·공급·회귀 잔여는 §8.4. 두 모드 정규 비교 전 채택/완료로 판정하지 않음. |
| W18-06/08의 독립 경계 추출 | **PARTIAL**. 공통 Skia TS package·canonical C++ binding/target·공통 frame clock과 직접 scene 인코더 구현. retained scene·text ABI·전체 SDK composition 이전은 미완료. |
| W18-03/04/05/07/09~12 | **NOT_STARTED**. 시제품의 dirty queue·text capture 변경은 아직 비용 수락 전이다. 각 단계의 전체 이전·최종 수락으로 승격하지 않음. |
| 기존 실행 기본값 | Hermes/optimized·RNW 유지. 직접 host 제품 기본 전환은 R0~R7 수락 뒤 진행. |
| architecture / engine / performance / memory | **notAccepted / notAccepted / false / notAccepted**. 기존 private 증가·RNW AV/종료 실패 유지. |
| physical / display / platform | **notVerified / unobserved / notAccepted**. 자동화·소스 확인과 물리 수락 구분. |

### 8.1 착수 inventory와 첫 구현 계약

- Node `24.15.0`, npm `11.17.0`. Hermes pin `94aa5e1d40a4ce99df79d951cbe45310ec40680c`, HBC99·JSI21·MD, 현재 toolchain manifest SHA-256 `a0d7d3c2a023a3610e0c12e4182fd6ab604cf9e3ca1a89a8533dd43a964e71ff`. Skia x64 Release/MD·JSI21 supplier manifest `d7af5017143c3044aad7277a0924672b4605b5b8b184f2849026c36a09d68289`. 기존 locator는 이 현재 공급을 참조한다.
- 착수 Core `framework.ts` SHA-256 `906d029e875ca1e207621f1a612ec98fb9473c2a396dbfc3c70070229a9b2978`; dist/Windows 설치 `framework.js`는 둘 다 `9b43b7fe8e796c1fc5068ef23a2733a03358cc041f24008375fc8456da387149`. 현재 두 제품 패키지는 `verifyNativePackage` 통과, native source identity `cdba6b89c7fcce315ff3e0e6c0908ba0eceb2ce0e90d42b4d3ac2c19fa618804`. 수정 후보와 비교용 설치본의 identity를 구분한다.
- 실제 catalog는 Material 36·Cupertino 20개 선언을 유지한다. Widget/State/GlobalKey·Inherited·ParentData·custom RenderObject/paint·Sliver/layout callback·navigation/overlay·편집/semantics는 기존 회귀와 Testbed의 소비 대상이다. 미구현 catalog 항목을 새 지원으로 표시하지 않는다.
- 첫 Runtime 계약: Element/State identity와 RenderObject geometry는 기존 객체가 단독 소유한다. `runtime/owner-transaction.ts`는 변경된 실제 render owner만 admission하고 build scope 끝에서 child-first로 한 번 commit한다. 실패 owner는 재시도 가능하게 남기고 성공 sibling은 재실행하지 않으며, unmount/close는 pending 참조를 제거한다. root/sliver/wheel/2D viewport가 같은 경계를 소비한다. numeric arena·사용자 객체 pooling·native layout kernel은 아직 채택하지 않았다.
- canonical inherited type만 `runtime/dependency-scope.ts`의 공유 scope 링크를 사용한다. provider마다 전체 Map을 복사하지 않는다. scope별 query memo는 누락 type까지 최대 4개이며 deactivate/GlobalKey 이동 때 index를 폐기/재연결한다. 동적 getter·instance token은 기존 ancestor 조회를 사용한다. mutable Widget/구독 owner는 `InheritedElement` 하나다.
- 지원 경로는 당분간 Windows direct bytecode/Static Hermes, RNW Hermes/V8/JSC, 현재 Web/Android를 유지한다. 퇴역한 경로는 없다. RNW AV·focus/종료, 메모리 보유/회수 근거, driver residency, 물리 IME/reader/display는 독립 잔여다.

### 8.2 현재 검증

착수 bytecode의 실제 ListView CPU 진단 1회는 정상 exit0·loaded host/VM/bundle identity·RN/Node-API JSI 미로딩을 확인했다. viewport 487×464.5 logical / scale 2, 접근성 on, 기존 cache 예산이다. retained 153 frames p95 7.499ms, cold 141 frames p95 18.720ms, fast 14 frames max 136.383ms. cold 할당 152,298,312 bytes, fast 132,839,360 bytes는 **phase 총량**으로, frame 수가 다른 후보의 개선율로 바로 쓰지 않는다. 시제품 착수 진단이며 3회 정규 비교·성능 수락을 대신하지 않는다. Static Hermes 기준선은 아래와 같으며 후보 비교는 진행 중이다. 임시 진단 package는 실행 finally에서 삭제한다.

Static Hermes 착수 CPU 진단 1회도 loaded identity·정상 exit0을 확인했다. 같은 logical viewport에서 retained 154 frames p95 6.650ms, cold 151 frames p95 17.409ms, revisit 164 frames p95 16.812ms, fast 15 frames max 134.946ms다. cold 할당 총량 156,788,632 bytes / fast 142,186,328 bytes. 물리/표시 수락으로 사용하지 않는다.

첫 sparse-owner/dependency 후보의 bytecode 1회는 retained 152 frames p95 7.017ms, cold 148 frames p95 17.877ms, revisit 156 frames p95 17.637ms, fast 15 frames max 139.097ms였다. cold의 built-frame당 할당은 약 1,080,130→1,044,537 bytes(약 3.3% 감소)이며 phase 총량 비교는 하지 않는다. **당시 25% CPU / 30% 할당 목표에 미달**하여 W18-02 완료·성능 채택으로 판정하지 않았다. 현재 할당 목표의 지위는 §5.1/8.5를 따른다. 이 첫 후보에는 아래 intrusive dirty queue와 text capture 변경이 아직 포함되지 않았다. 불충분한 후보를 수십 회 반복하는 대신 다음 원가를 개편한다.

### 8.3 현재 구현·공급 이전

- **Core owner**: `runtime/owner-transaction`의 child-first render commit, immutable dependency scope와 bounded 4-query memo, Element identity에 붙인 intrusive dirty queue와 nonempty scope list를 사용한다. root 전체 render sync와 ancestor dirty 전파를 제거했다. GlobalKey 재활성화 때 render/ParentData scope를 갱신한다. public custom sync/type getter·현재 ParentData widget·오류 의미를 유지하며 실패한 owner는 다음 boundary에서 재시도한다. 전체 W18-03 채택은 비용 수락 전이다.
- **text 입력**: ParagraphBuilder가 소유한 frozen record와 literal run/placeholder/font-family 배열은 다시 descriptor 객체를 만들지 않고 검증·공유한다. schema 결과는 정적 token을 저장하며 별도 `{tag,valid}` 할당을 제거했다. captured style 상속은 nested immutable 목록을 재캡처하지 않는다. 외부 frozen/Proxy/getter/iterator와 mutable Paint·image binding은 일반 경로다. backend 입력은 immutable descriptor이며 custom TextLayoutService의 mutable 작업 상태는 별도로 소유해야 한다. paragraph/query/paint ABI와 metric/paint revision 통합은 미완료다.
- **semantics 준비**: render owner의 fragment 배열을 재사용하고 delegate가 없으면 config Map을 만들지 않는다. conflict Set은 실제 충돌 때만 생성한다. delegate 실패 후 그룹·label·node ID가 정상 복구되는 실제 render tree 회귀를 추가했다. action table 지연 생성 후보는 frozen configuration의 기존 getter/등록 의미를 깨뜨려 제거했다. 접근성 on을 유지한다.
- **공통 Engine**: `@nelyx/skia-native`가 renderer·text·paint/path/image/picture/raster와 중립 타입을 소유한다. canonical C++/Vulkan binding은 `skia/native/adapters/jsi`, 공유 Windows header는 `native/host/windows`다. 직접 Hermes와 RNW는 같은 `engine.cmake`를 각각의 pinned VM/JSI cohort로 컴파일한다. 직접 host는 RN package를 resolve/compile하지 않는다. RN·Android·Apple 소비자는 같은 원본의 현재 generated 입력을 사용한다. 옛 renderer/text/type reexport facade는 제거했다.
- **scene**: 기본 native 경로는 Core 명령을 bounded numeric packet v1으로 직접 제출한다. Canvas facade·rest 배열·JS words 목록·per-command style/resource Map을 거치지 않는다. affine도 기존 inline column-major opcode로 인코딩하며 Matrix HostObject를 만들지 않는다. 원래 23 opcode의 generic 의미와 직접 경로의 동등성·float32 변환·preflight/native/disposal 실패·한도·동기 root 회수 검사가 통과했다. generic Canvas replay는 picture/raster와 명시적 비-capability adapter에 남는다. retained chunk와 Core recording 전체 이전은 미완료다.
- **SDK 공통 조립**: `runtime/native-assets`, `native-images`, `image-memory`, `native-interaction`, `native-engine`, `frame-clock`을 직접/RN이 공유한다. `createNativeEngineServices`가 같은 text/renderer/picture/raster/image 자원을 조립하고 application drain 뒤 renderer·미사용 startup context·shader를 반환한다. 직접 host도 `OwnedDisposal`의 명시적 phase/복구 순서를 사용한다. callbacks를 fence한 뒤 모든 frame 취소를 시도하며 falsey 오류를 보존한다. VM bootstrap/globals·전체 host main 분리와 시작/종료 상태 통합은 계속 미완료다.
- **입력 port**: `NativeInteraction/NativeEditorPort/NativeInteractionPolicy`로 소비자를 이전하고 RN-named export를 제거했다. Windows input service/view/key queue/keyboard route와 semantics packet은 `platforms/windows` 소유다. key/focus/text의 복사 자료는 Core `ui/input`에 한 번 정의하며 RN event/Skia 타입을 공유 port로 가져오지 않는다. semantics의 `surfaceId`에 RN adapter가 실제 Fabric tag를 매핑한다. keyboard/accessibility endpoint는 공통 runtime port이며 직접 host의 가짜 RN module 객체를 제거했다. 실제 OS packet/ack·UIA/IME 독립 수명은 유지한다.
- **Icon 시제품 이전 소프트웨어 확인**: Core scroll/layout/paint/editable/semantics·native scene/display-list/replay **45개 파일**, SDK engine/입력/수명/semantics/clock/font **15개 파일**이 통과했다. 공유 engine의 정상 close·startup 실패·미사용 context 회수·실패 drain 보유·명시적 복구를 포함한다. workspace 10개 type check, CLI declaration check와 native/application/supply 도구 검사도 해당 변경 단계에서 통과했다. 아래 공급·Web/Android·직접 host 결과에는 이후 Icon 시제품이 포함되지 않는다. 이 결과는 실제 제품·물리 수락을 대신하지 않는다.
- **공급**: Windows·Web·Android의 현재 Core/SDK/Skia native/RN/CLI archive와 설치본을 갱신했다. 공통 input·Engine·CLI의 source/설치 hash가 세 target에서 일치한다. 공유 pack directory의 native archive가 Web에 잘못 들어가는 분기를 수정했고 기존 owned Web native reference/archive·설치 package도 제거했다. runner supply 회귀와 CLI declaration 검사가 통과했다. RNW supplier는 `bd5059de779253ac69b61548d43ea3c07d94a987146536034287f944703380c8`이며 C++ compilation/link와 실제 ContentIsland 입력 bridge의 앞선 scoped 검증이 있다. RNW 앱의 AV·종료 실패 해결은 아니다.
- **최신 Web**: check와 실제 CanvasKit/WebGL2 static build가 통과했다. `application.js` SHA-256은 `4b5eda81950ce52cc0b2b49bdc658d65abe406349371011fdff4b35e1f81a2ef`다. Chrome에서 실제 ListView의 마지막/처음 이동·항목1000 선택 유지, Material Text inputs의 `한글😀 W18` 편집 값, Cupertino 전환·Favorite callback을 확인했고 관찰된 console error/warn은 없었다. 모든 catalog와 물리 IME 수락은 아니다. 검증용 탭과 HTTP server는 정리했다.
- **최신 Android**: 현재 `emulator-vulkan` profile의 x86_64 Release native/Java/Kotlin·Hermes bundle·APK build가 통과했다. arm64 기본값은 profile guard가 거부하며 이를 완화하지 않았다. 처음 GraalVM JDK 21의 `jlink` 변환에서 실패했고, 해당 subprocess의 `JAVA_HOME/PATH`만 설치된 Temurin 21.0.11로 지정해 같은 build를 완료했다. 시스템 Java 설정은 바꾸지 않았다. 공급된 Android Hermes 정책은 `android-5a1485-Og`이며 compiler SHA-256 `5cba24822d7cb50a7eafb85fe718d99490d2c582207c96c378cc5c7750a0010e`다. 연결 기기가 없어 runtime·물리 입력·qualification은 `notVerified`다.

**2026-10-26 현재 직접 host 공급**: 최신 text/semantics/SDK/affine 변경으로 bytecode와 Static Hermes 제품 build가 모두 통과했다. 두 package의 검증·현재 runtime source inventory 855 modules/11 owners가 일치한다. native source `31b6cdc9f3e1bfd547d25f9498d73201b412ef0c39db2c50ae6b535e01b250ec`, EXE `227eb499df9161d2827f8dea68b585ca5bef843e0982eb22d74c69952ffb5b6e`, HBC `283a3aea82f4244f9355aa08326ea3fd89c5979273b93092286ed7dace297075`, Static unit `9d420a0de8a95b223153db232dfb6208af662f09478f09dd1724eeba3cd5baf5`다. 최신 bytecode 실행의 loaded EXE/VM/bundle identity가 일치하고 RN/Node-API JSI는 미로딩이며 정상 close exit0·forced=false였다. 외부 UIA client는 foreground 획득에 실패하여 **최신 UIA 동작 미수락**이다. Esc로 컴퓨터 제어가 중단돼 추가 UI 조작은 멈췄다. Static의 최신 runtime/UIA 검증은 남아 있다. 앞선 공급의 두 모드 category/editor focus 결과를 새 공급으로 승격하지 않는다.

직접 scene/ParentData 이전 두 번째 후보의 bytecode 진단은 retained 151 frames p95 7.600ms, cold 150 frames p95 17.967ms·built-frame당 1,034,095 bytes, revisit 157 frames p95 17.515ms, fast 14 frames max 172.162ms였다. cold의 약 4.3%는 **built-frame당** 할당 비교일 뿐, 같은 완료 작업량의 할당 감소를 입증하지 않는다.

세 번째 후보(text capture·공통 asset/clock 포함, 위 semantics 배열/공통 Engine 조립/affine 이전)의 bytecode 1회는 foreground 검사와 4 phase를 마치고 정상 exit0이었다. retained 130 frames p95 9.244ms, cold 112 frames p95 20.945ms·phase 할당 128,727,448 bytes, revisit 124 frames p95 19.007ms·131,181,176 bytes, fast 14 frames max 159.040ms였다. 창 487×464.5 logical / scale2, 실제 list viewport314.5, 접근성 on이다. 시작 activation·화면 관찰이 포함된 진단이며 정규 동일 조건 비교가 아니다. 앞선 foreground 미소유와 뒤의 sampling 중 desktop pointer 이동 표본은 폐기했다. 검사 삭제·조건 완화 없이 desktop idle 때 재측정한다.

원인 분석용 [`profile-list-creation.mjs`](Nelyx/eng/profile-list-creation.mjs)는 실제 ListViewPage·앱 폰트·접근성 on·목적지10064 한 프레임의 V8 allocation sampling이다. semantics 임시 자료와 text 준비 비용을 확인했으며 이를 Hermes 시간/할당 수락으로 해석하지 않는다. profile/로그 파일을 남기지 않는다. **CPU 비용·메모리 보유/회수·RNW 안정성·물리 IME/reader/display는 여전히 미수락**이며 기본 host 전환과 전체 완료를 진행하지 않는다. VM 할당 감소율과 옛 plateau 한계의 필수 수락 지위는 §8.5에서 변경했다.

현재 검증 자식 process·임시 native probe·Web 탭/server는 종료했다. 다음 구현은 W18-02의 실제 행 생성/구조·style/text/layout 원가를 더 줄이는 후보에서 이어간다. 최신 두 Hermes 모드의 동일 조건 비용 비교, Static runtime/UIA와 bytecode UIA 재확인, VM bootstrap/globals·retained scene·paragraph/geometry commit 이전, RNW AV/종료와 R0~R7은 남아 있다. 컴퓨터 제어 중단을 성능·제품 수락이나 전체 작업 완료로 해석하지 않는다.

### 8.4 PAUSED — 2026-10-26 중간 마무리와 재개 지점

사용자 요청 직후 구현·추가 native 검증을 중지했다. HEAD는 `db27ecedd2c38e38c16753fa827c9b0cab77c911`이며 변경은 미커밋 작업 트리에 보존했다. 작업 소유 build/profile/test/native probe process가 남지 않았고 `git -c core.safecrlf=false diff --check`는 통과했다. 이전 archive·로그·독립 설치본을 추가 보관하지 않았다. 중단 당시 기본 host/engine과 미수락 상태를 유지했으며 이후 메모리 정책만 §8.5의 사용자 요청으로 변경했다.

- **마지막 구현**: [`icon.ts`](Nelyx/src/framework/widgets/icon.ts), 신규 [`icon-glyph.ts`](Nelyx/src/framework/rendering/icon-glyph.ts)는 non-null Icon 내부의 semantics/exclusion·고정 크기·정렬·RTL glyph paint를 한 render owner로 묶는다. glyph는 기존 RenderParagraph가 소유하며 private leaf Element의 sync는 이 직접 소유 child를 유지한다. 바깥 Icon/GlobalKey·IconTheme/Directionality 의존·paragraph/font attach/detach와 반환을 유지한다. null Icon은 기존 경로다. Core dist build가 통과했다.
- **통과한 해당 회귀**: 신규 [`icon-glyph.test.mjs`](Nelyx/eng/tests/icon-glyph.test.mjs)의 3 tests. 기존 public primitive 조합과 12개 조건의 실제 CanvasKit pixels·intrinsic/dry size·baseline·hit·semantics가 같고, 갱신 중 Key/render/semantics ID 유지, GlobalKey 재부착과 private paragraph의 최종 dispose를 확인했다. 각 테스트는 20분 timeout이다.
- **해결하지 않은 검사 실패**: `framework-reconciliation`, `semantics-translation`, Material `button-family`, `concrete-buttons` 4개 파일 재검사에서 **67 tests 중 65 PASS / 2 FAIL**. 실패는 `button-family.test.mjs`의 “actual IconButton glyph…”에서 `library.paragraphs.size` **3 !== 0**, `concrete-buttons.test.mjs`의 “all concrete icon/text variants…”에서 **14 !== 0**이다. 둘 다 child 제거 직후 zero paragraph 검사이며 fixture의 최종 close는 정상 수행됐다. 현재 bounded paragraph cache의 idle resident와 실제 producer/lease를 구분해 원인을 먼저 확인해야 한다. 신규 회귀의 `assertParagraphOwnership`은 통과했지만 이 사실만으로 두 실패를 해결 처리하지 않는다. 테스트 수정·기준 완화·추가 기능 구현은 중지 요청 뒤 수행하지 않았다.
- **비용 진단 한계**: 실제 ListView 목적지10064 한 프레임의 Node/V8 sampled allocation은 Icon 전 **13,523,536** → 후 **12,631,952 bytes**였다. 약 6.6%의 진단 차이이며 sampling 오차·V8/CanvasKit 범위다. Hermes cold/revisit CPU 개선이나 같은 완료 작업량의 할당 감소를 입증하지 않는다. 추가 정규 비교는 실행하지 않았다.
- **공급 차이**: repo Core dist만 Icon 시제품으로 갱신했다. Windows/Web/Android runner의 archive·설치 Core와 현재 두 Hermes package·Web bundle·Android APK는 **Icon 이전 공급**이다. 세 설치본에 `rendering/icon-glyph.ts`는 없다. 이 설치본들을 최신 repo Core로 qualification하지 않는다. native source/ABI는 Icon 시제품으로 변경하지 않았다. VM bootstrap/globals 개편은 검토만 했으며 추가 구현과 ABI 변경은 없다.

재개 확인용 SHA-256:

| 파일/범위 | SHA-256 |
|---|---|
| Core `src/framework/widgets/icon.ts` | `3d3ed56e8a0babed058a3cfd3230d28f106732ad41d5c91ccbdd4d9644e462a6` |
| Core `src/framework/rendering/icon-glyph.ts` | `0241dfe003cff08fd8c124b9409c2cec5d9e241224a970cfaf1943950dc31b8e` |
| `eng/tests/icon-glyph.test.mjs` | `4b7c6460742ef7345483db992093c6fe5735799650dc9e7bb9938eab363a4546` |
| repo Core `dist/framework/widgets/icon.js` | `01a35a3d5618b93ca01f14257299d561b4d60f38775748da47fc082b3033bc10` |
| 세 runner 설치 Core `src/framework/widgets/icon.ts` | `8fae308f0867c18c4a8f463326eab43d4b52885dc333460350fe17eabc631449` |
| 세 runner 설치 Core `dist/framework/widgets/icon.js` | `30eebdfd55727650319d6d16d736052dfbce3d777c8b5977841703f74127f125` |

**다음 시작점**: 현재 diff·위 hash·소유 process를 다시 확인하고 두 Material paragraph-count 실패의 실제 resource/cache owner를 판별한다. 해당 회귀를 해결한 뒤 W18-02의 남은 구조·style/text/layout 원가를 개편하고, 선택된 후보를 현재 공급·두 Hermes 실제 경로에 반영한다. 이후 W18-03~12의 전체 이전·retained scene/text/geometry·SDK VM/host 조립·RNW 안정성·R0~R7을 계속한다. 정규 비용·메모리 보유/회수·UIA/물리 IME/reader/display 수락 전 전체 완료나 기본 host 전환을 하지 않는다.

### 8.5 메모리 정책 변경 — 2026-10-26, 실행 PAUSED 유지

사용자가 “Nelyx만의 구조를 위해 필요하다면 메모리를 사용해도 된다”고 명시했다. 이 지시는 옛 고정 메모리 한계 유지와 cache 예산 동결보다 우선한다. §3.4/3.5/3.8·시제품 기준·R5를 함께 변경했다. 임의의 process/GPU 상한·3회 plateau·allocation count 증가0을 제거하고 cache/prefetch/pool/retained 자료 보유를 설계 선택으로 허용한다. VM 할당 30% 감소는 참고 지표다. 필요한 메모리의 목적과 이득, owner·회수/축소·압박/실패 대응을 검증한다.

`native-memory-results`는 bytes/count·전체/마지막3회 증감을 관측만 하며 큰 수치나 증가만으로 실패하지 않는다. `native-scroll`의 resource 반복 검사도 cache resident의 동일 tail/64-entry·32MiB를 강제하지 않고 모든 회차의 resident를 보고한다. 입력/부하/identity 검증과 논리 producer 복귀·native frame drain은 유지한다. 관측 완료를 메모리 수락으로 승격하지 않으며 `memoryAccepted=false`를 명시한다. W17 실패 기록·원시 수치와 §8.4의 두 미해결 테스트는 보존한다. 현재 제품의 cache 크기·native ABI·공급본은 바꾸지 않고 메모리 정책·관측 도구/회귀·사용법만 변경했다. 새 native 측정이나 중단한 구현 재개는 하지 않는다.

이 변경의 확인은 `native-memory-results.test.mjs`와 `native-scroll-report.test.mjs`의 20분 timeout 단위 검사 **11 PASS / native 실행 1 SKIP**다. 기존 상한을 넘는 수치·연속 증가·GPU allocation0을 정확히 보고하고 메모리 수락으로 오인하지 않는지, 잘못된 계수·입력/부하/identity·producer 복귀·frame drain 실패는 계속 거부하는지 확인했다. 제품의 메모리·성능을 새로 측정한 결과가 아니다.

## 9. 공식 원본과 적용 범위

아래 자료는 **2026-10-25** 확인했다. 원본의 일반 계약은 참고 근거이며 Nelyx에서의 개선율·ABI 호환·실제 플랫폼 지원을 증명하지 않는다.

| 원본 | 적용 범위 |
|---|---|
| [Flutter architectural overview](https://docs.flutter.dev/resources/architectural-overview), [Inside Flutter](https://docs.flutter.dev/resources/inside-flutter) | Widget/Element/RenderObject 역할·증분 build/layout·상태 보존을 참고. Flutter layout을 전부 C++ engine이 수행한다는 전제로 설계하지 않음. |
| [TypeScript: Erased Types](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types) | TS 정적 타입과 실제 JS 실행 자료구조를 구분. 별도 Static Hermes 특화 정책의 성공을 이 문서로 추정하지 않음. |
| [고정 Hermes pin의 직접 API](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/API/hermes/hermes.h) | 직접 runtime/SHUnit API의 source 경계. 실제 DLL export·CRT·JSI·compiler/runtime 공급 일치는 실행 시 확인. |
| [Emscripten Embind memory views](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#memory-views) | WASM kernel을 선택할 경우의 view/소유 메모리 수명. TypedArray 노출이 자동 수명 보장을 뜻하지 않음. |
