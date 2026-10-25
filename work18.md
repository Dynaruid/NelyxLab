# W18: Nelyx 기반 개편 — TypeScript UI Runtime·공통 Engine·플랫폼 Host 재설계

작성일: **2026-10-25 KST** · 주 수락 대상: **Windows x64 Release / Hermes bytecode·Static Hermes / 실제 Testbed 앱**

> **계획 ACTIVE / READY · 구현 NOT_STARTED · 제품 PARTIAL · performanceAccepted=false · physicalInputAccepted=notVerified · displayed=unobserved.** 이번 요청은 소스·이전 결과를 검토하고 새 계획을 작성하는 문서 작업이다. 구현·패키지 교체·native 측정은 시작하지 않았다. Nelyx 기반 개편의 유일한 활성 계획은 이 문서이며, [W17](work17.md)은 **CLOSED / SUPERSEDED BY W18**이다.

**W18은 기존 구조의 작은 최적화를 이어 붙이는 작업이 아니라, Nelyx가 상태·트리·레이아웃·텍스트·scene·자원을 보유하고 갱신하는 기반을 다시 만드는 작업이다.** TypeScript로 앱과 Widget·State를 작성하는 제품 방향, Nelyx 자체 콘텐츠 레이아웃, Hermes 기본 엔진 방향은 유지한다. 내부 클래스 구조·저장 방식·모듈·native ABI·공급 방식은 교체할 수 있다. 기존 소스와 API를 모두 그대로 보존하는 것을 개편의 전제로 삼지 않는다.

주안은 **TypeScript에 맞춘 UI Runtime과 RN에 종속되지 않는 공통 Engine을 분리**하는 것이다. Widget/Element와 RenderObject의 서로 다른 역할은 유지하되, 내부의 중복 projection·전역 재탐색·반복 snapshot·동결·encode를 줄이고 실제 변경 단위로 갱신한다. native는 Skia·문단·자원·recording·GPU 작업을 소유한다. **layout 전체의 C++ 이전은 확정하지 않는다.** JS에서 실행해야 하는 사용자 builder·State·custom layout이 남으므로, 언어만 바꿔 경계 호출을 늘리는 설계는 별도 시제품에서 이득과 의미 보존을 확인한 범위만 채택한다.

## 0. W17 종료와 승계

W17 종료는 host 구현의 중간 결과를 보존하면서 실행 계획을 교체하는 결정이다. 버벅임·메모리 증가·물리 입력 문제가 해결됐다는 뜻이 아니다. W17 §1~8의 단계와 마지막 재개 지시는 역사적 자료로만 읽으며, W18 실행을 W17의 마지막 메모리 진단부터 강제로 시작하지 않는다.

| W17의 구현·미해결 | W18의 처리 |
|---|---|
| 직접 Hermes host, 전용 runtime thread, HWND/Composition, 입력·TSF/UIA, CLI 공급 | 재사용할 제품 기반. 다시 시제품 host를 만드는 단계로 되돌아가지 않고 공통 Engine/Host 경계를 정리한다. |
| display-list1의 23 opcode, bounded input, generation·GPU drain | 이미 있는 기능이다. 새 비용·수명 구조에 통합하며 출력·오류·retirement 계약을 보존한다. |
| cold/revisit/fast의 긴 프레임, 행 생성·layout·할당 비용 | W18의 주 개편 대상. 캐시 확대·샘플 축소·AOT coverage만으로 해결 처리하지 않는다. |
| process private commit plateau 실패, driver residency 미확인 | 원인과 owner가 미확정인 독립 필수 항목으로 승계한다. 공통 자원 개편과 함께 조사하고 고정 수락 한계는 유지한다. |
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
| [`text-painter.ts`](Nelyx/src/framework/painting/text-painter.ts), [`text-layout-cache.ts`](Nelyx/src/hosting/text-layout-cache.ts) | 문단·측정·query 수명과 cache가 이미 있으며 스타일·입력·출력 snapshot이 여러 계층을 지난다. | 캐시를 새로 추가하는 대신 canonical text/style 입력과 문단 owner를 통합한다. 실제 shaping 비용과 JS 준비 비용을 분리한다. |
| [`renderer.ts`](Nelyx/skia/packages/rn/src/renderer.ts), [`display-list.ts`](Nelyx/skia/packages/rn/src/display-list.ts) | native display-list 경로에서도 Core PaintFrame을 `replayFrame`이 방문하고 batch canvas가 native packet을 만든다. renderer는 최대 2개 in-flight lease를 관리한다. | JS 명령 객체→snapshot→renderer 방문→packet의 중간 표현을 줄인다. 이미 비동기인 GPU 제출을 다시 비동기화하는 계획은 반복하지 않는다. |
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
- **기본 수락은 cache/prefetch/keep-alive 예산을 늘리지 않은 cold·revisit에서 한다.** 모든 행을 보존하거나 gallery를 작은 데모로 바꿔 통과시키지 않는다. 필요 없는 내부 할당·전체 탐색·중복 layout을 먼저 제거한다.
- native kernel 후보는 대량 숫자 geometry·extent 탐색·순수 layout 계산처럼 입출력 경계가 닫힌 연산이다. JS→native 준비·copy·검증·결과 소비를 포함해 비교한다. custom callback마다 재진입하거나 노드마다 HostObject를 만드는 후보는 채택하지 않는다.
- kernel을 채택하면 native와 Web의 의미를 함께 제공한다. WASM을 쓰는 경우 memory/view 수명·성장·호출 비용을 검증하고 CanvasKit과 별개 모듈의 pointer를 공유하지 않는다. JS fallback을 쓰면 명시적 capability와 동등한 동작을 제공한다. 이득이 없으면 kernel 분기만 제외하고 TS Runtime 개편은 계속한다.
- `LayoutBuilder`·custom RenderObject·CustomPainter·ParentData·intrinsic/baseline·transform/hit test의 현재 지원 계약을 이전한다. 현재 미지원인 기능을 이번 작업으로 모두 새로 구현한다는 뜻은 아니다. 기존 지원을 숨은 fallback이나 기능 축소로 대체하지 않는다.

### 3.5 text·style·font·paragraph

- text content/run style/paragraph style/font catalog/locale/direction/scaler/width를 명시적 revision과 소유 descriptor로 정규화한다. 동일 입력을 TextPainter·hosting cache·backend가 각각 깊게 복사·동결·key 생성하지 않게 한다.
- native paragraph는 한 resource owner가 layout·paint·query lease를 관리한다. caret/selection/range geometry를 같은 문단 revision에서 얻는다. 이전 문단을 교체할 때 제출된 frame·UIA read가 끝나기 전 해제하지 않는다.
- text 측정의 동기 의존은 숨기지 않는다. 순서를 바꾸지 않는 독립 request만 batch할 수 있으며, 부모 constraints에 의존하는 layout을 무조건 비동기로 바꾸지 않는다.
- metric-only·paint-only 변경, 폰트/폭/theme/DPI/locale 변경의 무효화를 분리한다. 한국어·RTL·혼합 run·emoji·fallback font·가변 scaler·mutable Paint와 사용자 getter를 포함한다.
- cache는 기존 bounded 정책을 기준으로 resident bytes·entry·live lease를 함께 제한한다. shaping의 실제 CPU, JS 입력 준비, hit 후 재사용 비용을 따로 본다. cache hit만으로 subtree 생성 비용이 해결됐다고 보고하지 않는다.

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
- 기존 최대 2개 in-flight, bounded CPU 준비·recording·texture 정책을 기본으로 승계한다. 새 queue·pool·arena·retained scene도 bytes/count 한계를 가진다. full buffer·native wrapper·rooted callback을 전역 cache에 계속 남기지 않는다.
- W17의 private commit 증가를 address region→실제 allocation/retained owner로 좁힌다. VM live/capacity·native allocator·Skia·UIA/COM·Vulkan·process private를 따로 관찰한다. owner가 확인되기 전 GC 옵션·driver leak으로 결론내리지 않는다.
- W17의 **private 1GiB / Vulkan 512MiB**, 마지막 3회 span **8MiB / 1MiB**, 순증가 **1MiB / 64KiB**, Vulkan allocation count 순증가 **0**을 유지한다. 강제 GC·반복 수 확대·허용치 완화로 plateau를 통과시키지 않는다. 이 bounded 관측의 PASS도 전체 driver residency 수락과 같지 않다.

## 4. 소스·패키지·공급 이전

아래 새 경로·패키지는 **설계상 목적지이며 아직 생성하지 않았다.** W18-01에서 실제 import graph와 최소 export를 확인한다. 폴더 이름만 바꾸고 동일 adapter chain을 남기는 작업으로 완료 처리하지 않는다.

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

작업 단위는 파일 수가 아니라 **한 owner/계약의 구현→실제 소비→옛 경로 제거**다. 각 단계의 최소 기능 회귀와 필요한 공급 확인을 끝낸 뒤 진행하며, 매 단계 전체 SDK·전체 native matrix를 반복하지 않는다. 현재 아래 구현 단계는 모두 **NOT_STARTED**다.

| ID | 작업과 주요 산출물 | 단계 완료 조건 |
|---|---|---|
| **W18-00 현재 기준선·잔여 inventory** | HEAD/diff·source/dist/설치·toolchain/locator·실제 loaded identity와 기존 실패 목록 확인. 전체 catalog의 지원 동작·extension·자원 owner를 짧게 정리. 실행 불가능한 baseline만 우선 수리. | 이번 Nelyx로 비교 가능한 현재 공급 확보. 원인 진단/정규 비교/물리 수락 범위를 분리하고 기존 실패를 누락하지 않음. |
| **W18-01 Runtime/Engine 계약·이전 설계** | §3·4의 소유권·record·dependency·frame/text/resource ABI·thread/close 상태·API 변경표 확정. source import graph와 RN-neutral 추출 대상, 최종 지원/퇴역 후보 경로 확인. | 중복 mutable 기준·순환 의존·OS 타입 누출 없음. 기존 소비자마다 이전 단계가 있고 unsupported 기능·퇴역 영향이 명시됨. |
| **W18-02 최소 구조 시제품·선택** | 실제 ListTile/ListView·텍스트·semantics의 한 경로에 새 record/transaction·증분 갱신을 적용. 현재 직접 host에서 두 Hermes 모드 비교. 필요한 순수 native kernel만 작은 대조로 검토. | builder/State/Key·출력·입력 의미를 보존한 실제 경로. §5.1의 구조·비용 목표로 자료구조를 선택하고 미채택 후보는 제거. |
| **W18-03 Element·dependency·수명 교체** | 새 child/dependency/dirty 소유권과 transaction 구현. reconciliation·Inherited·GlobalKey·ParentData·detach/rollback을 이전. | 상태·callback 순서·오류 후 tree/registry 일관성 회귀 통과. 해당 소비자의 중복 projection/sync와 이전 record owner 제거. |
| **W18-04 RenderObject·layout·Sliver 교체** | 새 dirty boundary·geometry commit·extent/anchor·lazy child 생성/퇴장. custom layout/paint 확장점 연결. | fixed/variable extent·far-seek·역방향·resize/RTL·keep-alive·hit test/scroll 의미 보존. 기존 예산에서 cold/revisit 비용 대응. |
| **W18-05 text/style·paragraph owner 통합** | canonical descriptor·폰트 revision·paragraph/query/paint lease·bounded cache. metric/paint-only 변경과 편집 geometry 연결. | 한국어/RTL/run/fallback/scaler·caret/selection·교체/retirement 동등. 반복 snapshot과 중복 key 변환 제거, 잔여 shaping 비용 구분. |
| **W18-06 공통 native Engine·scene 경로 교체** | 공통 `skia-native`·canonical native target 추출. Core recording→native/Web adapter의 직접 소비와 retained chunk·packet ABI 구현. | 현재 paint/clip/effect/paragraph/picture 출력·오류·lease 동등. default 경로의 이중 replay/encode 제거, 제한·generation·GPU drain 유지. |
| **W18-07 입력·편집·semantics commit 통합** | 같은 geometry commit의 input/hit/UIA/IME 연결, focus/selection/action·snapshot retirement. | 입력량·순서·capture/cancel·physics·텍스트 상태 보존. stale owner/revision 거부, 접근성 on의 자동 기능 회귀. 물리 수락은 별도 유지. |
| **W18-08 SDK Runtime·host 조립 개편** | 공통 bootstrap/close·서비스 port·globals/capability·VM owner와 Windows embedder 분리. RN/Web adapter 연결. | RN runtime 없이 직접 host 시작·재개·실패·정상 close. timer/microtask/오류 경계·loaded identity·OS 자원 소유 확인. |
| **W18-09 실제 디자인 패키지·앱/API 이전** | Material/Cupertino의 현재 전체 catalog, sample·template·custom API 소비를 새 기반으로 이전. 필요한 API/import 변경과 문서 반영. | 작은 fixture 외에 실제 Testbed 전체 동작. 테마·navigation/dialog/overlay·focus·편집·State 보존. 마지막 소비자의 호환 wrapper 제거. |
| **W18-10 현재 제품 공급·플랫폼 회귀** | 새 package closure·source→dist→설치→bundle/HBC/AOT/EXE/DLL 일치. 실제 앱의 두 Hermes 모드, 영향받은 Web/Android 검증. | 이전 ABI/locator/변조 공급 거부. 현재 설치본의 실행·응답·종료 확인. 플랫폼별 확인/미확인 경계를 README에 반영. |
| **W18-11 최종 성능·메모리·물리 수락** | §6의 동일 부하 비교, W17 private 증가 원인·수정/회수 확인, 실제 표시·precision/IME/reader 검증. | 각 모드·창·화면·phase별 판정. 미관측/실패를 유지하며 필수 미달 시 전체 PARTIAL. |
| **W18-12 기본 전환·퇴역·정리** | 수락된 경로를 CLI/template/launcher 기본값으로 전환. 앞서 정한 지원/퇴역 결정을 실제 소비자 이전·공급 결과와 대조하고 미사용 분기·wrapper·출력 정리. | 지원하는 경로의 필수 실패 0, 사용법과 실제 기본값 일치. 퇴역/미채택과 해결을 구분하고 활성 구현 owner가 하나임. |

주 의존 순서는 **00 → 01 → 02 → 03 → 04/05 → 06 → 07/08 → 09 → 10 → 11 → 12**다. text·Engine의 경계 추출, 메모리 owner 조사 등 독립 작업은 관련 계약 확정 후 진행할 수 있다. W17 메모리 plateau나 최종 physical gate를 모든 구조 개편의 선행조건으로 삼지 않는다.

### 5.1 시제품의 결정 기준

W18-02는 완전한 새 engine을 만든 뒤 평가하는 단계가 아니다. 실제 앱의 대표 행/목적지 생성 경로와 동일한 의미를 사용하는 작은 구현에서 **생성·구조 변경·style/text 준비·layout·paint 준비**의 원가를 함께 확인한다. 단순 도형·scalar benchmark만으로 채택하지 않는다.

설계 검증 목표는 동일 조건의 cold/revisit에서 **frame CPU wall p95 25% 이상 감소와 동일 완료 작업량당 VM 할당 30% 이상 감소**, retained p95의 **10% 초과 악화 없음**, 자원 한계·출력·입력 의미 보존이다. 이는 **아직 측정하지 않은 목표**이며 최종 §6 수락을 대체하지 않는다. frame 수가 다른 phase의 총 할당량을 그대로 개선율로 쓰지 않는다.

기능을 보존해도 비용 목표에 못 미치면 원인을 분해해 record 배치·갱신 경계·native kernel 중 필요한 선택을 바꾼다. 같은 후보에 GC/heap·cache·샘플 조건만 바꿔 성공시킬 수 없다. 근거 없는 후보를 제거하고 설계를 고친 뒤 다음 단계로 진행한다. 시제품 목표를 이유로 수백 회 비교하거나 이미 알려진 W17 문제만 반복 조사하지 않는다.

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
| **R5 메모리·안정성·종료** | §3.8의 고정 한계·bounded plateau와 owner 회수 확인. 지원 대상의 원인 미확정 AV·종료 실패 없음. close/drain·late callback·UIA peer·VM 파괴 경계 통과, 정상 exit0/강제 종료 없음. driver residency는 관측 범위 별도 표기. | H4 |
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
| retained chunk·paragraph·UIA snapshot이 메모리를 보유 | bytes/count·read/frame lease·retirement와 close를 함께 제한. W17 private 실패는 새 구조에도 독립 재검증. |
| Web/WASM가 별도 engine 또는 copy-heavy 경로가 됨 | 공통 TS UI 의미와 Engine port 유지. WASM 채택 시 해당 build/메모리/브리지 비용까지 평가. 채택 안 한 kernel에 Web 바이너리를 추가하지 않음. |
| 지원 플랫폼/기능을 줄여 성능만 수락 | 실제 catalog·접근성 on·동일 부하, 플랫폼별 기능·회귀와 표시 수락을 분리. 퇴역 경로는 이유/소비자/대체를 명시. |

## 8. 현재 상태와 다음 시작점

| 항목 | 현재 상태 |
|---|---|
| W17 실행 계획 | **CLOSED / SUPERSEDED BY W18**. 종료 시 구현·제품 결과는 PARTIAL이며 실패·미확인 범위 유지. |
| W18 계획 | **ACTIVE / READY**. 현재 소스·W17/research·공식 원본을 검토한 새 실행 기준. |
| W18 구현 / 공급·native 검증 | **NOT_STARTED / 미실시**. 새 Runtime·Engine 패키지·ABI·kernel은 아직 구현하지 않음. |
| 기존 실행 기본값 | W17 문서의 마지막 상태는 Hermes/optimized·RNW. 이번 문서 작성으로 실행 기본값을 바꾸지 않음. 실제 시작 시 확인. |
| 이번 확인 범위 | 문서 변경·참조 경로·상태/단계 정합성·`git diff --check`. 제품 동작·성능·물리 수락의 새 증거 없음. |
| 다음 단계 | 구현 요청을 받으면 **W18-00 → W18-01 → W18-02**부터 시작. W17의 마지막 private-memory 진단 명령을 그대로 반복하지 않음. |

착수 시 현재 HEAD·dirty·변경 소스와 dist/설치/locator/loaded identity를 다시 확인한다. 사용자 변경을 보존하고 실제 필요한 현재 입력을 재사용한다. 먼저 owner·API·지원 동작 inventory를 이 문서에 짧게 정리한 뒤 최소 새 Runtime 경로를 구현한다. 문서 작성 완료를 기반 개편 완료나 구현 재개로 표시하지 않는다.

## 9. 공식 원본과 적용 범위

아래 자료는 **2026-10-25** 확인했다. 원본의 일반 계약은 참고 근거이며 Nelyx에서의 개선율·ABI 호환·실제 플랫폼 지원을 증명하지 않는다.

| 원본 | 적용 범위 |
|---|---|
| [Flutter architectural overview](https://docs.flutter.dev/resources/architectural-overview), [Inside Flutter](https://docs.flutter.dev/resources/inside-flutter) | Widget/Element/RenderObject 역할·증분 build/layout·상태 보존을 참고. Flutter layout을 전부 C++ engine이 수행한다는 전제로 설계하지 않음. |
| [TypeScript: Erased Types](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types) | TS 정적 타입과 실제 JS 실행 자료구조를 구분. 별도 Static Hermes 특화 정책의 성공을 이 문서로 추정하지 않음. |
| [고정 Hermes pin의 직접 API](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/API/hermes/hermes.h) | 직접 runtime/SHUnit API의 source 경계. 실제 DLL export·CRT·JSI·compiler/runtime 공급 일치는 실행 시 확인. |
| [Emscripten Embind memory views](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#memory-views) | WASM kernel을 선택할 경우의 view/소유 메모리 수명. TypedArray 노출이 자동 수명 보장을 뜻하지 않음. |
