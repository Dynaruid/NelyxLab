# W18: Nelyx 기반 개편 — TypeScript UI Runtime·공통 Engine·플랫폼 Host 재설계

작성일: **2026-10-25 KST** · 주 수락 대상: **Windows x64 Release / Hermes bytecode·Static Hermes / 실제 Testbed 앱**

> **실행 IN_PROGRESS · 구현 PARTIAL · 제품 PARTIAL · performanceAccepted=false · physicalInputAccepted=notVerified · displayed=unobserved.** 2026-10-26 전체 작업 요청으로 재개했다. 현재 Windows native 제품·카드 그림자 수정은 §8.62(이전 두 열 검증 §8.60), 웹 viewport 수정은 §8.61, Core/SDK·영향 플랫폼 공급은 §8.59, 마지막 외부 입력 UIA는 §8.57이다. 새 Core source §8.58의882개 회귀와 §8.59 제품/플랫폼 검증이 통과했으며 새 공급의 외부 입력 UIA는 미검증이다. 새 공급의 ZIP round-trip과 전체 제품 수락은 아직 완료되지 않았다. View 제출/close·문단 nominal 경계에 이어 §8.54의 같은 View 입력/query admission과 실제 SDK 종료 소비를 구현·검증했으며, 다음 구현 경계와 미수락 범위는 §8.58/8.59를 따른다. 시작 HEAD `76ca0f145b7a1ea7c22b265fcbec4a70ff446368`와 clean baseline을 확인했고 이전 일회성 정리 스크립트는 디스크에 없다. Nelyx 기반 개편의 유일한 현행 계획은 이 문서이며 [W17](work17.md)은 **CLOSED / SUPERSEDED BY W18**이다.

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
| W18 계획 | **IN_PROGRESS / PARTIAL**. 2026-10-26 전체 작업 요청으로 재개. 현재 공급·실행·외부 UIA는 §8.55이며 다음 canonical text/geometry·SDK 경계도 같은 절을 따른다. |
| W18-00 | **COMPLETE — inventory/비교 기반 범위**. 착수·현재 HEAD/diff, toolchain/locator·직접 host의 source/dist/설치/loaded identity와 기존 실패를 기록했다. §8.10의 비교 기준선과 §8.55의 실행 가능한 두 모드 공급을 확보했다. RNW 과거 AV·최종 제품/성능/물리 수락은 별도다. |
| W18-01 | **PARTIAL**. 아래 첫 owner/소비자 계약 확정. 공통 native 패키지·scene/text ABI 이전 설계는 계속 필요. |
| W18-02 | **SELECTED / PASS-scoped**. §8.20/8.21 aggregate의 두 모드 cold/revisit 각 paired trial25%·retained guard, 관련 기능/수명 회귀·현재 제품 공급·scoped resource-cycle3회 통과. 이전 미달/미채택 후보 기록은 보존한다. 이는 대표 경로의 시제품 선택 완료이며 fast·전체 R0~R7/제품 수락이 아니다. |
| W18-06/08의 독립 경계 추출 | **PARTIAL**. 공통 Skia TS/C++·frame clock·직접 scene 인코더, VM 환경 owner·host ABI2와 callback owner를 구현했다. §8.42/44의 단일 packet·Core FrameRecording·SDK asset capture와 §8.54의 실제 native/RN View admission·종료 재진입 경계를 현재 소비자가 사용한다. 현재 공급은 §8.55이며 전체 retained scene·text/geometry ABI·SDK composition 이전은 남아 있다. |
| W18-03 | **IN_PROGRESS / PARTIAL**. §8.22 Element/focus SCC 분리, §8.27 실패한 GlobalKey 재배치 복구, §8.29/8.37/8.40의 nominal class/factory·tree/inline-text owner 이전을 구현·검증했다. 전체 단계와 최종 성능/물리 수락은 구분한다. |
| W18-04 | **IN_PROGRESS / PARTIAL**. §8.23 layout admission/body 실패 뒤 canonical owner 복구와 detached batch 거부를 구현·검증했다. 전체 geometry/Sliver 이전은 남아 있다. |
| W18-05 | **IN_PROGRESS / PARTIAL**. §8.24 native/Web 문단 cache/provider의 captured font catalog/revision, §8.40 RichText·WidgetSpan의 단일 선언 owner와 실제 nonlinear geometry/State/retirement·현재 공급을 확인했다. §8.56에서 문단·편집의 source painter 경로를 통합했으며 전체 text/style·query/paint·편집의 최종 수락은 남아 있다. |
| W18-09 실제 앱/API 이전 | **IN_PROGRESS / PARTIAL**. nominal factory/tree의 실제 소비자 이전과 README 반영, §8.33 Web catalog 전체 선언/대표 callback·route·상태, §8.41 두 native 모드의 편집기 focus/Material·Cupertino range action을 확인했다. 전체 native catalog/확장점·입력/접근성 수락은 별도다. |
| W18-10 공급의 독립 검증 | **IN_PROGRESS / PARTIAL**. §8.57의 세 target source/dist/설치·두 Hermes의 첫 frame/응답/정상 close·외부 UIA·CLI doctor, Web Chrome4·Android Release build·RNW 실행/수동작 없는 UIA 조회를 확인했다. 새 ZIP 재검증은 자동 승인 검토 거부로 notVerified다. 과거 AV·VM PC symbol·기기/전체 플랫폼/최종 성능 수락은 남는다. |
| W18-07 입력·semantics commit | **IN_PROGRESS / PARTIAL**. §8.48의 CPU geometry/semantics publication과 §8.54의 failed/closing View input/query·retained action fence, 이미 보낸 편집/조합 취소 receipt를 실제 소비자에 연결했다. §8.57 두 모드의 외부 focus/range UIA가 통과했으며 전체 geometry/frame association·물리 IME/reader 수락은 별도다. |
| W18-11/12 | **NOT_STARTED**. 선택한 시제품 변경을 각 단계의 전체 이전·최종 수락으로 승격하지 않음. |
| 기존 실행 기본값 | Hermes/optimized·RNW 유지. 직접 host 제품 기본 전환은 R0~R7 수락 뒤 진행. |
| architecture / engine / performance / memory | **notAccepted / notAccepted / false / notAccepted**. 기존 private 증가·RNW AV/종료 실패 유지. |
| physical / display / platform | **notVerified / unobserved / notAccepted**. 자동화·소스 확인과 물리 수락 구분. |

### 8.1 착수 inventory와 첫 구현 계약

- Node `24.15.0`, npm `11.17.0`. Hermes pin `94aa5e1d40a4ce99df79d951cbe45310ec40680c`, HBC99·JSI21·MD, 현재 toolchain manifest SHA-256 `a0d7d3c2a023a3610e0c12e4182fd6ab604cf9e3ca1a89a8533dd43a964e71ff`. Skia x64 Release/MD·JSI21 supplier manifest `d7af5017143c3044aad7277a0924672b4605b5b8b184f2849026c36a09d68289`. 기존 locator는 이 현재 공급을 참조한다.
- 착수 Core `framework.ts` SHA-256 `906d029e875ca1e207621f1a612ec98fb9473c2a396dbfc3c70070229a9b2978`; dist/Windows 설치 `framework.js`는 둘 다 `9b43b7fe8e796c1fc5068ef23a2733a03358cc041f24008375fc8456da387149`. 현재 두 제품 패키지는 `verifyNativePackage` 통과, native source identity `cdba6b89c7fcce315ff3e0e6c0908ba0eceb2ce0e90d42b4d3ac2c19fa618804`. 수정 후보와 비교용 설치본의 identity를 구분한다.
- 실제 catalog는 Material **29**·Cupertino **20**개 demo 선언을 유지한다. 최초 Material36 집계에는 category7개가 섞였으며 §8.6에서 HEAD/현재 source와 실제 순회로 정정했다. 목록을 삭제·축소한 것이 아니다. Widget/State/GlobalKey·Inherited·ParentData·custom RenderObject/paint·Sliver/layout callback·navigation/overlay·편집/semantics는 기존 회귀와 Testbed의 소비 대상이다. 미구현 catalog 항목을 새 지원으로 표시하지 않는다.
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

### 8.6 IN_PROGRESS — 2026-10-26 전체 작업 재개

재개 HEAD `f59c049a28862d35348ddff417d7405894aa1f66`, 시작 dirty 없음. §8.4의 Icon 소스·회귀·Core dist 네 hash가 일치했다. 이전 제품 package·세 runner 설치본은 Icon 이전 공급이었다. 해당 차이와 과거 진단을 새 공급 수락으로 승격하지 않는다.

- **기존 실패 수리**: Material 두 문단-count 실패를 재현했다. producer/frame 반환 뒤 남은 문단이 cache resident와 정확히 같은지, 실패 owner가 없는지 확인하는 기존 `assertParagraphOwnership`으로 이전했다. 최종 registry/library close의 문단·폰트 0 검사는 유지한다. 편집·디자인 회귀에서도 같은 잘못된 resident=count 검사가 발견됐으며 변경 전 RenderParagraph로 재실행해 기존 실패임을 확인했다.
- **발견한 실제 자원 문제**: 완료한 Zoom transition의 모든 SnapshotController가 false이고 Image producer가 0인데도 덮인 페이지의 무효한 repaint/EngineLayer 기록이 이미지를 보유했다. dirty retained owner만 admission하고 성공한 frame 뒤 숨은 무효 기록·ancestor scene cache를 반환한다. 깨끗한 숨은 기록과 State, 안정된 OffsetLayer 링크는 보존한다. 제출 frame의 독립 lease가 마지막까지 이미지를 보유하는 회귀와 기존 Navigator Zoom 회귀가 통과했다. 해당 scene/paint 회귀 98개가 통과했다.
- **문단 초기화**: 소유한 불변 span/style/scaler/resource ID와 locally captured painter options만 이미 해석한 configuration으로 직접 초기화한다. 중복 configuration 작성·초기 update의 JSON 비교를 줄인다. custom span/scaler·Paint·Locale/StrutStyle/TextHeightBehavior·외부 resource/getter·serialization hook은 일반 경로를 유지한다. 실제 자산의 ID capture는 SDK bootstrap에서 한 번 수행한다. custom 준비/serialization callback 회귀가 통과했다.
- **반복 style 준비**: 소유한 불변 TextStyle에만 base당 최근 color/fontSize/locale 조합 하나를 약하게 보유한다. ListTile 기본 role/slot과 Text의 locale/size 해석이 이를 소비한다. 기존 merge cache도 정확한 captured style·원래 copyWith/options descriptor로 제한했다. Proxy·custom receiver·copyWith/options getter·mutable typography/Paint는 일반 경로를 유지하며 getter 순서 회귀를 포함해 통과했다.
- **layout 무효화**: 동기 layout transaction에서 이미 덮인 순수 ancestor prefix의 paint 무효화를 공유한다. custom boundary/retirement/parent/owner hook 앞에서 일반 순회를 재개한다. 중간 paint·편집 geometry 관찰·실패 때 batch를 닫으며 detach 때 ancestor 참조를 지운다. 반복 geometry 변경의 마지막 출력, layout 도중 중간 repaint, custom getter/hook 호출 순서 회귀가 통과했다.
- **Divider 구조**: finite square Divider/VerticalDivider는 한 layout owner와 실제 canonical decoration painter를 사용한다. theme/Directionality/locale 조회와 public State/Key 경계를 보존한다. rounded/nonfinite 입력은 원래 Core 구성이다. 기존 독립 구성과 **32개 axis/direction/dimension/radius 조건**에서 실제 CanvasKit 전 픽셀·wet/dry/intrinsic/baseline/hit 결과를 대조했고 keyed theme/direction 갱신·private child 반환까지 통과했다.
- **미채택 후보 제거**: built-in AnimatedDefaultTextStyle의 선형 초기 controller/ticker/curve 지연 생성은 실제 Core recording의 retarget·TickerMode·곡선 교체·onEnd·State/반환 회귀3개를 통과했지만 두 모드 진단에서 일관된 이득을 보이지 않았다. bytecode cold/revisit p95 **15.956/16.431ms**, Static **14.427/13.808ms**였고 현재 Divider 후보의 각 **17.019/14.992**, **13.734/12.234ms**와 비교해 목표를 입증하지 못했다. 해당 구현·추가 API·전용 검사는 제거하고 원래 animation owner로 복귀했다. 이 미채택 시점의 Node sampled allocation 10,843,928 bytes도 현재 제품·Hermes 수락 근거로 사용하지 않는다.
- **VM/Host 조립**: 공통 `runtime/vm-environment`가 VM당 설치·단일 app claim·timer/frame/microtask/rejection·console·close를 소유한다. app callback과 GPU drain timer의 admission을 분리했다. 직접 host ABI **2**와 vm/services/editing/semantics capability **1**을 요구하며 이전 ABI·누락 port를 bootstrap 전에 거부한다. C++ `VmCallbacks`로 runtime-thread callback storage와 timer/frame checkpoint를 main에서 추출했다. 닫힌 app의 새 timer는 pinned Hermes의 Promise tracker가 원래 오류를 대체하지 않도록 inert handle만 반환한다. 실제 Hermes C++ harness에서 microtask 오류·닫힌 VM의 handled rejection·late callback fence·독립 GPU drain timer·callback thread와 frame cancel/reentry를 확인했다.
- **시작 실패와 공급**: SDK source와 emitted map의 마지막 수정 불일치를 실제 inventory가 거부했다. SDK 재빌드 뒤 원본·dist·map·세 설치본의 동일 hash와 map sourcesContent를 확인했다. 생성 entry는 VM 환경 반환 뒤에도 공통 오류 formatter를 통해 host에 실패를 보고한다. 실제 pinned Hermes에서 `throw undefined`와 hostile Error.stack 두 시작 실패가 **exit1 / forced=false / native error 없음**으로 통과했다. Core/Material/SDK/Skia native/CLI의 현재 공급은 세 runner에 반영했다. 현재 두 제품은 각각 **858 modules / 11 owners / generated 제외3**, package153/156 files, 실제 창 `Responding=True`·정상 exit0·forced=false·stderr 없음·RN/Node-API JSI 미로딩을 확인했다. Static의 compiled nativeFunctions는 **37,084**이며 전 body의 실행을 뜻하지 않는다. host source `fe4a092da4a8a283c697acb222ca6a3d0b9d40446a1189a59279e45092596f71`; compiler/Skia cohort는 §8.1과 같다.
- **공급 사전 검사**: `prepare-sample`은 workspace manifest의 실제 package 경로에서 원본·emitted map 입력을 검사한 뒤 패킹한다. 오래된 dist·누락 map·owner 밖 source·사라진 dist를 runner 변경 전에 거부한다. source-only MJS package는 emit을 요구하지 않는다. 새 거부/복구 검사3개와 기존 동일 버전 재공급/rollback 검사까지 **4 PASS**, 현재 **10 packages / emitted modules1177 PASS-scoped**다. JS compiler 재현성·native/runtime 수락의 대체 검사가 아니다.
- **Web/Android 범위**: Divider/layout batch의 Web check/build와 실제 Chrome의 EditContext·moveBefore fallback·nonvisual DOM 입력 **3 PASS**다. ListView 선택/휠/far 이동/resize, Material/Cupertino 조합·양방향 caret·undo·form·dialog·theme 중 State/편집 보존을 검증했다. Web application SHA-256 `2c56409344f4572b9cbc6662a39f7e496f23c1752fea6ac4118bc8a7e09b59ed`, map `52ca7ac90a3c82ce8afd65fed320a018e036a1bf1a68e77fccc4ef8bad267789`. 같은 공통 Core/Material의 Android x86_64 Release emulator-vulkan 빌드 PASS, APK `2838b43b6d3d102d7cde1d347e6f79915e1cf5beaf0ac1faacfde65df899d2ca`. process-local Temurin21 사용. 미채택 animation 후보 제거·SDK 수정 뒤 재빌드한 Web JS/map과 APK도 이 hash와 같아 기존 실제 Web 입력 검사의 범위를 유지한다. CDP는 물리 IME 수락이 아니며 연결 Android 기기가 없어 runtime은 `notVerified`다.
- **실제 catalog·자원 복귀**: 현재 bytecode에서 planned를 포함한 Material29·Cupertino20 demo의 cold/revisit 노출을 전부 확인하고 정상 exit0·1247 surface frames를 얻었다. Material36은 category7을 함께 센 inventory 오류였다. HEAD/현재 두 catalog source는 내용이 같고 각각29/20이며 축소하지 않았다. section-seek 진단의 Material cold/revisit p95 **33.137/45.056ms**, max **110.240/55.315ms**, Cupertino **20.244/19.416ms**, max **112.103/29.277ms**로 R3 미달이다. continuous OS 입력/실제 표시 수락으로 사용하지 않는다. 별도 bytecode **3회**의 ListView 진입→cold/revisit→양 끝 이동→gallery 복귀에서 tree **814/381/16**, producer **32 / units198 / bytes50720**, picture **6 / 80384bytes**, native **[1,0,1,0,0]**가 매회 복귀했다. resident cache는 관측하며 process private/GPU/driver·전체 memoryAccepted는 계속 미수락이다.
- **검증 경계**: 현재 Divider/layout 후보의 전체 디자인 **260 PASS**, scroll **169 PASS**, workspace **10개 type check·CLI declarations PASS**, native Hermes 단위 **43 PASS / opt-in 3 SKIP**와 위 실제 시작 실패 검사 **1 PASS**다. 미채택 animation 시점의 scroll172는 제거한 검사3개를 포함한 과거 범위다. package boundary는 **949 files / 7761 runtime edges / design cycles0 PASS-scoped**다. 실제 C++ harness의 packet pixel parity·generation/retirement·Hermes GC·native UIA provider 검사가 통과했다. 컴퓨터 제어는 `native pipe is unavailable`이고 browser inventory도 비어 있어 현재 제품의 화면 관찰·UIA focus 조작은 수행하지 못했다. 정규 성능·물리 입력·표시·RNW AV/종료·메모리 압박/driver residency·R0~R7은 계속 미수락이다.

최근 실제 CPU 진단은 아래와 같다. 각 행은 **1회 진단**이며 baseline/후보 3회 정규 비교가 아니다. viewport487×464.5·scale2·접근성 on·1000행/80px·기존 cache 예산이며 모두 정상 exit0이다. phase마다 built frame 수가 다르므로 총 할당량으로 개선율을 만들지 않는다. 전체 비용 목표 미달, **performanceAccepted=false / displayed=unobserved**를 유지한다.

| 후보 / 모드 | retained frames / p95 ms | cold frames / p95 ms | revisit frames / p95 ms | fast frames / max ms |
|---|---|---|---|---|
| Divider·layout batch / bytecode | 153 / 7.130 | 157 / 17.019 | 167 / 14.992 | 18 / 104.420 |
| Divider·layout batch / Static Hermes | 152 / 6.379 | 170 / 13.734 | 185 / 12.234 | 19 / 103.292 |

§8.6 종료 당시 제품에서 실제 로드한 SHA-256은 다음과 같다. §8.7 시제품 이전 공급이며 위 진단용 bundle hash와 제품 identity를 섞지 않는다.

| 제품 파일 | SHA-256 |
|---|---|
| 공통 `NelyxHermesHost.exe` | `1f8c6ffa64070ce6c2baf25ba90721f6476f22b5bdc92954ef0ff7d4a8a1b059` |
| 공통 `hermesvm.dll` | `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696` |
| bytecode `app.hbc` | `4c865fd726174ffa0bedc2a50bb1da92be881861109bfd2294f665a9571d660d` |
| Static `NelyxApp.aot.dll` | `05be2bea623a5cfe5f0f2cbc9f2e5542b341f5cb1916eabae67902f9704dbe43` |

검증 파일이 쓰던 불필요한 raster/JSON 출력을 제거했고 `.tmp/work12`의 기존 11개 파일도 반환했다. 잘못된 첫 시작 실패 검사가 만든 중복 `.nelyx/native-windows/toolchain`과 `.startup-fixture-ZILwQF`는 소유 process를 종료한 상태다. 두 임시 경로의 삭제는 자동 승인 검토가 **`blocked by policy`**로 거부하여 미완료이며 우회 삭제하지 않았다. 현재 검사는 기존 pinned host 입력과 실행별 finally 정리를 사용한다.

마지막 공급 확인에서 SDK README의 현행 수락 링크도 W18로 교체하고 세 runner에 반영했다. 문서 변경 뒤에도 두 제품의 package·현재858-module source/owner 검사가 통과했고 주요 Core/Material/SDK/CLI 원본·dist·문서가 repo와 세 설치본에서 같은 hash다. 현재 검증 child process·native build/scroll 임시 디렉터리·Web server/browser는 모두 반환했고, 위 삭제 거부 두 경로만 남는다. `git diff --check` 통과. 실행 상태는 **IN_PROGRESS**이며 사용자 중단·전체 완료로 전환하지 않았다.

**이어갈 작업**: W18-02 비용 목표는 미달이다. 기존 Hermes PC 진단에 나온 `finishLayer`/layer 재연결·paint transform 및 현재 전체 catalog 생성 원가를 근거로 Core recording/retained scene의 중간 표현·갱신 단위를 다음 구조 후보로 검토한다. 의미·owner·실제 cold/revisit 이득을 입증하지 못한 후보를 누적하지 않는다. 선택 뒤 W18-03~12의 전체 이전, 두 모드 정규 비교·RNW AV/종료·압박 대응·물리 IME/reader/display와 R0~R7 잔여를 수행한다. 기본 host는 계속 RNW/Hermes optimized다.

### 8.7 IN_PROGRESS — retained recording owner 시제품

HEAD `f59c049a28862d35348ddff417d7405894aa1f66`와 기존 dirty를 보존했다. 아래는 **현재 source/dist/공급**의 결과이며 §8.6 제품은 시제품 이전 공급이다. W18-02/06의 구조 후보를 진행 중이고 전체 채택·완료는 아니다.

`PaintingContext`의 Canvas 상태별 `RecordedCanvasLayer` 계층을 제거했다. `RecordedCompositionLayer` 하나가 상태 scope record와 실제 Layer의 삽입 순서·반환을 소유하며 상태마다 EngineLayer/Canvas를 만들지 않는다. 실제 child attachment/callback·public append/remove·detach 중 이전 geometry·leader/follower·clip query 순서와 행렬의 원래 double 연산 순서를 보존한다. 기록은 body 교체/폐기 때 반환하며 외부가 폐기 Layer를 보유해도 private scope/명령/child 배열을 비운다. 제출 frame은 독립 lease를 유지한다. 별도 renderer·전역 pool·cache 예산 증가는 추가하지 않았다.

**회귀:** 전체 디자인 **260 PASS**, paint/scene **103 PASS**, scroll **169 PASS**, native replay **25 PASS**, workspace **10개 type check PASS**. 수명 보완 후 Core 재빌드·paint103을 다시 확인했다. 신규5는 24중첩 상태의 실제 Layer 수/변환, child 재연결/불변 snapshot, shared/empty clipPath query 순서, image-shader state/frame 반환, **9개** clip/matrix/saveLayer/backdrop recipe의 CanvasKit 전체 픽셀을 독립 direct Canvas 출력과 비교했다. 마지막 backdrop 추가 후 신규5도 통과했다.

**공급:** Core archive SHA-256 `a99e110804e8619511a2547b0f2d115402f6a0a1fb2b4c8539a7733538b40833`를 세 runner에 공급/설치했다. 아래 repo 원본·dist와 Windows/Web/Android 설치본 hash가 같다. source guard의 **10 packages / 1177 emitted modules PASS**는 captured TS input 일치 범위이며 compiler reproducibility 수락은 아니다.

| Core 파일 | source SHA-256 | dist SHA-256 |
|---|---|---|
| painting/recorded-layer | `e3e9c2e6f6cdd8cecf2fbef3db62950701dbf0d09d8fb101cdd0323396958d1b` | `0bd370aaceae7917d57c20f3bc249186c9b35932f42fb46b2d8b7a10e8ff7cc3` |
| painting/context | `f84f063bf5a2c69b5c299a12d05f59a5d1f0bfce368cec69f27f235cf38e2a39` | `d8369b4f699f5edb6a8fb47cc33f60478236dc31ad6316bd303ff4b5c9aa29f3` |
| ui/scene | `3b5a863ac6feeca92744359259063e5b463998b8b754f36a547a1cea7bbbdb67` | `2d7fc36bd73802f35690e7af17d1dcfae73269f1d05a98a88d8381a25a4d2bc0` |

**현재 Windows 제품:** 두 모드 모두 재빌드했다. 각각 package153/156 files·현재858 modules/11 owners(생성 코드3 제외)가 통과했고, 7초 실행에서 최초 frame·`Responding=True`·유효 HWND/제목·5 surface frames·정상 exit0/forced=false/stderr 빈 문자열을 확인했다. 79/80 loaded modules에 RN/Node-API runtime이 없다. 공통 host `52b1e8c912062e6b0a51fe87816c72fe71fc478dbeb6147ce92276b3273448b9`, VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`, host source identity `fe4a092da4a8a283c697acb222ca6a3d0b9d40446a1189a59279e45092596f71`다. Static의 wholeAppNativeAot=true는 컴파일 범위이며 전체 함수 실행·성능/물리 수락은 아니다.

| 제품 bundle | 실제 loaded SHA-256 |
|---|---|
| bytecode app.hbc | `a6cfdc7154bccd24de3aa032fb617767b5d231813f1139b5bdba043c82cd0cfb` |
| Static NelyxApp.aot.dll | `e293812b2850b8365b61bb3c2d26a67c5ee900fa170dbace3236ec79f0a77f71` |

**현재 비용 진단:** 수명 보완 후 각 모드 **1회**의 아래 결과다. viewport487×464.5/scale2·접근성 on·기존 cache 예산·1000행/80px·programmatic 입력을 유지했고 timed phase에는 다른 빌드/검증이 없었다. 표의 retained/cold/revisit는 frames / callback wall p95, fast는 frames / max다.

| 모드 | retained / ms | cold / ms | revisit / ms | fast / ms |
|---|---|---|---|---|
| bytecode | 153 / 6.058 | 165 / 15.257 | 165 / 15.633 | 18 / 108.058 |
| Static Hermes | 154 / 5.616 | 172 / 13.649 | 180 / 12.824 | 20 / 88.166 |

cold/revisit p99는 bytecode **17.623/20.795ms**, Static **15.747/15.385ms**다. 진단 bundle은 bytecode `16507cdbec828adcafa295fa1d8bc11e238db642486c303c21365badcfe99283` / Static `4f52e9d178228366999fca170a651cfce1559649fbf1ea18769144dd931a2c2d`이며 1205/712 surfaces·정상 exit0이다. 첫 시제품 bytecode(수명 보완 전)의 cold/revisit p95는 15.347/14.934ms였고, 첫 Static 실행은 출력 요약기의 phase 필터 오류로 시간 수치를 남기지 못해 정량 비교에서 제외했다. **25% cold/revisit 목표·R3 미달**, baseline/후보 각3회 정규 비교·OS/표시 수락은 미수행이다.

**자원/기능:** 현재 bytecode의 3회 ListView 왕복에서 producer32/units198/bytes50720, pictures6/bytes80384, native[1,0,1,0,0]가 복귀했다. resident94/units665→637/bytes146082→146436은 기존 cache 관측이며 private/GPU/driver·전체 memoryAccepted를 증명하지 않는다. 전체 native catalog는 Material **29/29**·Cupertino **20/20**을 정방향 cold/역방향 revisit에서 모두 노출하고 10 phases·1306 surfaces·정상 종료했다. section seek이며 Static image 컴파일과 겹친 기능 전용 실행이므로 CPU 비교·continuous OS/물리 표시 수락으로 사용하지 않는다. 해당 실행은 Static timed phase 전에 끝났다.

**플랫폼:** 현재 Web check/build·실제 Chrome 입력 회귀 **3 PASS**(ListView wheel/선택/far seek/resize, Material/Cupertino 편집·조합·테마/State·DOM 대체). JS `2940272c8a6385fe8047d158ed2ae7643fd005b415c289589b445c63d83eee8e`, map `5df582f5da5b51c759c4df4a7cf185b998be93ea9019f012a5ba2f9d5b7fd149`, CanvasKit은 §8.6과 같다. CDP 입력은 물리 IME 수락이 아니다. Android x86_64 Release/emulator-vulkan 빌드 **PASS-scoped**(1m10s), APK `cf65430e55ac57ca8a69a4f9f423cb64cb65341a43ed30b16e9841c8cfb0116c`다. process-local Temurin21·기존 compiler policy를 썼고 기기 런타임은 미확인이다.

**다음 비용 원가:** 구조 변경 뒤 bytecode PC sampling1회(657 surfaces·정상 종료)를 다른 빌드와 분리했다. cold635 observations에서 childTransform self16, Material paintTransform self15/inclusive43·native replay24·GC26, revisit651에서 paintTransform self11/inclusive40·replay42·GC34, retained에서 finishLayer self8/inclusive36, fast에서 GC51/554와 semantics 생성이 남았다. PC 횟수는 CPU ms·개선율이 아니다. Node/CanvasKit의 실제 far10064 한 frame sampled allocation 10,928,616bytes도 별도 진단이다. ink/reference geometry의 중복 경로·primitive 준비, recording/packet 경계·cold 생성/semantics를 다음 구조 후보로 검토한다. custom shape/getter/hook과 visible rows·접근성·입력량은 보존한다.

실행 상태는 계속 **IN_PROGRESS / PARTIAL**, architecture/engine/memory는 notAccepted, performanceAccepted=false·physicalInputAccepted=notVerified·displayed=unobserved다. W18-03~12의 전체 이전·정규 두 모드 비용·RNW AV/종료·압박/driver residency·UIA/물리 IME/reader/display와 R0~R7 잔여를 수행해야 한다. 기본 host는 RNW/Hermes optimized를 유지한다. 새 검증은 실행별 finally 정리를 사용하며 이전 삭제 거부 `toolchain`/`.startup-fixture-ZILwQF`의 미완료 경계는 §8.6대로 유지한다.

현재 제품·Core·Web·APK의 문서 hash **13개**를 실제 파일과 대조했고 `git diff --check`도 통과했다. 실행 소유 native/검증 child process·build/scroll 임시·공급 staging·Web server/browser는 반환했고 `.tmp/work12`는 비어 있다. 삭제 거부 두 경로만 남는다. 다음 구현은 현재 공급을 기준으로 ink/reference geometry의 공통 경로를 한 paint owner에서 재사용할 수 있는지 검토하며, custom callback 앞뒤의 무효화와 원래 행렬 연산 순서를 먼저 보존한다.

### 8.8 REJECTED / REMOVED — paint geometry prefix cache

이전 goal turn은 recording 구현·공급·검증을 만든 **progress**다. 시작 HEAD/dirty·§8.7의 두 제품153/156 files·현재858 modules/11 owners를 다시 확인했다. 실제 ListView ink8개가 24 render edge를 지나는 것을 조사해 Core paint owner의 prefix cache를 시제품으로 만들었으나 **미채택/제거**했다.

- 시제품은 기본 box 변환·offset·수학 연산과 등록 prototype만 재사용하고 custom getter/Proxy/hook은 일반 경로를 유지했다. 독립 원래 알고리즘과 수치·순서·reparent/실패/중첩 회귀7개, 디자인260·paint110·scroll169·native replay25·타입10이 통과했다. 최초 class static block 등록은 RN Babel이 거부하여 모듈 초기화 구문으로 고쳤다. 이 검사 수는 제거 전 후보 범위다.
- 실제 bytecode **1회**, 동일 viewport487×464.5/scale2·접근성 on·1000행/80px·기존 cache 예산·programmatic 입력에서 retained154/cold152/revisit159/fast18 frames의 p95 **7.096/16.390/16.008/98.656ms**였다. retained p95가 §8.7의 6.058ms보다 10% 이상 나쁘고 cold도 악화했다. HBC `f39a37f1b858590e6e85d9a1fe00a772dc9e9fbd888b29a55c5e1e3e6ee59512`, host/VM은 §8.7과 같으며 681 surfaces·정상 exit0이다. 원래보다 유리한 모드만 찾는 반복을 하지 않고 Static 비교 전에 거절했다.
- cache/class/API·prototype 등록·생성 brand·수학 helper·그에만 필요한 검사7개를 전량 제거했다. Core object 원본/dist는 다시 `30a1accdc4f756e858be0f8bc30fab809b8a2391cc041360d386eb699418f958` / `38c200efba633369357fad310ee1ac3c82f646527acefc43f75cdb6f769501f6`로 복귀했다. hot 경로에 reflection/map 검증을 덧붙이는 구조의 순이득을 입증하지 못했으며, 이 결과를 새 geometry commit 구현 완료로 처리하지 않는다.

**남긴 독립 수정:** Material ink의 중첩 paint가 복귀할 때 `painting=false`로 바꾸어 외부 paint가 아직 진행 중인데도 feature 변경을 허용하던 오류를 고쳤다. 시작 상태를 저장/복구해 가장 바깥 paint까지 mutation fence를 유지한다. 새 회귀1개는 내부 성공/실패 두 경우 모두 fence·canvas balance·이후 변경/폐기를 검증했고 통과했다. Core/Material 재빌드·windows/web/android 세 설치 공급 복원·디자인260/paint104 회귀가 통과했다. Material owner source/dist는 `ae48312181a6455727a825256ea4a19c25f8c9903a7c42f64e810014c4aa126d` / `6e250e0cb74f34e2058656756c5a58743be9c801144b0e0506de9fae706c8be4`다.

§8.7 제품/플랫폼은 이 독립 Material 수정 이전의 마지막 검증 공급이다. 전체는 **IN_PROGRESS / PARTIAL**, 성능·메모리·물리 수락은 미완료다. 다음 구조 후보는 기존 class/adapter에 검사를 누적하는 대신 canonical record의 생성·갱신 원가 자체를 줄이는 방향에서 고른다.

### 8.9 IN_PROGRESS — semantics flag record 후보

`SemanticsConfiguration`의 매 setter가 24개 필드의 immutable `SemanticsFlags`를 다시 만들던 경로를 단일 소유 31비트 상태로 바꾸는 후보를 구현 중이다. Checked4상태·Tristate6개·boolean17개를 담으며 기존 engine flag mask와 구분한다. 외부에 게시할 때만 기존 필드 형태의 immutable snapshot을 만들고, configuration의 최신 snapshot 하나만 보유한다. 전역 strong cache·수명 연장 pool은 없다. public constructor/copyWith·외부 subclass/Proxy 값의 일반 경로, copy/absorb/노드 게시·동일 값 재지정의 snapshot 식별은 보존한다.

첫 표현의 Core source/dist·세 설치 공급, 독립 회귀6개·semantics-updates25/접근성81/Windows semantics12·타입10·디자인260/paint104/scroll169가 통과했다. bytecode 1회는 retained154/cold155/revisit164/fast19 frames, callback wall p95 **6.112/16.260/14.916/94.274ms**, cold/revisit p99 **18.858/28.801ms**, fast max **94.274ms**였다. HBC `ff5b9f63c7ee157289a6cec552e2672879b43281a04d7f79cfb9c98a98fe788a`, host/VM은 §8.7과 같으며 684 surfaces·정상 exit0이다. 25% 목표 미달이며 표현을 그대로 채택하지 않았다.

첫 Node/CanvasKit far10064 한 frame sampled allocation은 10,974,560bytes, 그중 flags 게시 함수가 308,928bytes였다. 필드별 descriptor 24개를 만들던 부분을 공개 형태·prototype·freeze를 유지하는 한 객체의 직접 초기화로 바꿨다. 변경 후 Node 표본은 10,737,416bytes였다. 이 Node 값은 Hermes 시간·할당의 증거가 아니다. 직접 초기화 bytecode 1회는 retained152/cold166/revisit170/fast18 frames, callback wall p95 **6.117/14.451/15.832/101.086ms**, cold/revisit p99 **16.129/18.810ms**, fast max **101.086ms**, HBC `6ce3ba4ebec60ce5d4d432ec4f78a466e9c0fbc1d0b57e73f6e24297a657b7a8`, 707 surfaces·정상 exit0이다. 같은 설치 공급 Static 1회는 retained154/cold169/revisit177/fast19 frames, p95 **5.559/13.888/13.303/90.489ms**, cold/revisit p99 **17.414/15.068ms**, fast max **90.489ms**, native unit `08c7b3cc9ea8d16fffaca17d8c2ef3be11a235646a6ca0b7bcb9834b36d6587e`, 698 surfaces·정상 exit0이다. 이 표현의 목표는 미달이며 다음 소유 record 연산을 포함하지 않는다.

**현재 내부 계약 변경:** configuration의 canonical annotation 갱신·병합·충돌 검사를 packed record에서 직접 수행한다. 과거 `SemanticsFlags.prototype.merge` 교체가 configuration의 내부 absorb에도 적용됐지만 새 경로에서는 직접 값 객체 호출에만 적용된다. 공개 Flags 필드·값 메서드는 유지하며 사용자 정의 configuration은 공개 setter/absorb subclass 또는 render object의 `describeSemanticsConfiguration`을 사용한다. 이 전후 사례·이전 방법을 Core의 영문/한글 README와 소스 API 설명에 반영했다. private 표현을 계속 가상 값 객체로 왕복하지 않기 위한 변경이며 ABI/wire flag 값은 바꾸지 않는다. 외부 subclass/Proxy 값은 일반 경로로 처리한다. Core 재빌드·세 설치 공급, 독립 회귀7개(16개 복합 상태쌍·별도 충돌 경계 포함)·semantics26/접근성88/Windows semantics12·디자인260/paint104/scroll169/native replay25가 통과했다. Node의 같은 한 frame sampled allocation은 10,539,224bytes였다. 현재 새 bytecode 진단을 진행 중이며 위 이전 표현의 두 모드 결과와 구분한다.

소유 record 연산 bytecode 1회는 retained153/cold162/revisit167/fast20 frames, callback wall p95 **6.351/14.384/15.309/93.282ms**, cold/revisit p99 **20.597/19.406ms**, fast max **93.282ms**, HBC `1e1ddd58dfacd3be44f7d2730d70d6160eacb5199e1f3c7fdb3aab6af509f9e9`, 695 surfaces·정상 exit0이다. Static 1회는 retained153/cold166/revisit182/fast22 frames, p95 **5.437/15.152/12.996/75.397ms**, cold/revisit p99 **19.046/15.265ms**, fast max **91.739ms**, native unit `5b4599869f77cea526ac8a6248413168e5d312f50763cc5efebe934837945c3d`, 698 surfaces·정상 exit0이다. 두 모드 모두 source/host/VM은 §8.7과 같고 빌드·프로파일링과 timed phase를 겹치지 않았다. **단일 진단의 편차와 목표 미달**을 유지하며 정규 대조를 진행한다.

§8.7 제품 hash를 새 소스의 실행 증거로 사용하지 않는다. 전체 상태와 R0~R7 수락 경계는 그대로 **IN_PROGRESS / PARTIAL**이다.

### 8.10 IN_PROGRESS — 같은 공급의 3회 비교 준비

진단 실행기의 `--repeat 3`은 한 package를 빌드한 뒤 trial마다 새 process를 시작한다. trial/PID·loaded identity·phase/창을 구분하고 전체 묶음에 기존 20분 deadline과 하나의 finally 임시 owner를 적용한다. 1~3회 CPU만 허용하고 resource-cycle/sampling 반복과 섞지 않는다. 양 창이면 6개 실행이며 추가 SDK/소비자 설치본을 만들지 않는다. 반복/창 배치·거부와 기존 report 검증을 포함한 회귀 **6 PASS**다.

대조군은 재개 HEAD `f59c049a28862d35348ddff417d7405894aa1f66`의 **Core/Material 제품 TS 구현**, 공통 조건은 현재 manifest·SDK/Skia·ABI2 host/VM·실제 Testbed·폰트·접근성 on·기존 cache·default487×464.5/scale2·programmatic4 phases다. 현재 SDK가 쓰는 `ui/resource-retention` export를 포함한 manifest는 양쪽에 공통 적용한다. 초기 W18 전체 제품을 그대로 재현한 기준선이라고 부르지 않는다. 변경된 제품 소스만 실행 소유 임시에 잠시 보관하여 대조군을 빌드/공급하고, 원래 소스 byte·현재 dist를 복구한 뒤 측정한다. 전체 SDK/설치본을 복제하거나 과거 archive를 보관하지 않는다. 종료 finally에서 Windows도 후보 공급으로 복귀한다.

두 모드 각각 대조/후보 **3회**, 총 **12회**를 완료했다. 동일 package·fresh process·정상 exit0이며 loaded host/VM·RN/Node-API JSI 미로딩이 일치한다. 아래는 3개 trial의 median [min~max]와 각 표본 수다. 기존 단일 진단을 합치지 않았다. 이 묶음은 §5.1의 대표 창 비교이며 OS 입력·전체 catalog·두 창 최종 수락·물리 표시의 대체가 아니다.

| 공급 / 모드 | retained p95 ms | cold p95 ms | revisit p95 ms | fast max ms |
|---|---|---|---|---|
| 대조 / bytecode | 7.041 [6.930~7.098]; n=152/152/151 | 18.078 [17.575~19.659]; n=140/140/147 | 16.197 [15.772~17.009]; n=160/164/165 | 121.934 [116.090~143.711]; n=15/17/17 |
| 대조 / static-aot | 6.498 [6.114~6.613]; n=153/151/153 | 15.449 [14.923~16.356]; n=165/167/155 | 14.133 [13.967~14.936]; n=177/174/175 | 102.817 [99.481~141.013]; n=17/17/16 |
| 후보 / bytecode | 6.299 [6.231~6.484]; n=154/153/153 | 15.914 [15.328~16.210]; n=161/155/154 | 15.376 [14.473~16.177]; n=170/166/164 | 108.062 [95.809~108.806]; n=19/19/18 |
| 후보 / static-aot | 5.636 [5.447~7.335]; n=153/153/153 | 13.136 [12.775~13.495]; n=169/171/171 | 12.563 [12.560~13.843]; n=181/179/171 | 95.462 [92.248~114.929]; n=19/18/21 |

cold/revisit median 감소는 bytecode **11.97%/5.07%**, Static **14.97%/11.10%**로 **25% 목표 미달**이다. retained median은 양 모드에서 개선됐으나 Static trial2의 7.335ms는 대조 trial2 6.114ms보다 약20% 높아 개별 trial의 10% guard도 충족하지 못했다. 후보 fast의 모든 trial max는 50ms를 넘는다. **W18-02 선택/완료·R3·성능 수락으로 승격하지 않는다.** frame 수가 다른 phase 할당량으로 감소율을 만들지 않는다.

대조 archive Core `75c9c2a48a6cd27ae1467bada98254584a187d2535d446d9f497c1504b715bc3` / Material `50caf9a198abec04516c8a098d7b65aea25ab84c259f5b898ae48165333027cf`, 후보 archive Core `92d303428cde4485fe59a6df390ff8b223cf792f1733222403afd28c809a6abe` / Material `07f614f5d101ac7b94379c37bc8ccc47312a65fe6053dc848347f13b22bd9bf6`다. 대조 HBC/native unit은 `c1c86cada27397b06e1ae5751ee845a3bfc9174d2fb263151655f844d11aa2ec` / `5fbf72860afeeba5ebeb3cbdcb0df1ed0c8eebf2683ecfc6ff37f1fb3b482a74`, 후보는 `1e1ddd58dfacd3be44f7d2730d70d6160eacb5199e1f3c7fdb3aab6af509f9e9` / `5b7fc557fd3f9882ba1d190b8787cf4d3d8faf829dbfa84ccd95cfbcbf7bf350`이며 각 이미지가 해당 모드3회에서 같았다. host/VM/source는 §8.7과 같다. 12 PID가 구분됐고 package153/156 files·module79/80을 확인했다.

비교는 19개 변경 제품 TS와 untracked1개, **587,691bytes**만 일시 보관했다. 원래20개 소스 byte와 현재 Core/Material dist를 측정 전에 복구했고 종료 finally에서 Windows 후보 공급도 복귀했다. 소스 복구 aggregate SHA `d1dfbd2ba6b36ca643c04b507cdfe323aaaad3e9ea0f412ec7aa6cd4b12d9e94`·설치 source20개 대조가 통과했으며 임시 script/소스 사본·대조 archive를 별도로 남기지 않았다.

### 8.11 IN_PROGRESS — 기본 투명 ink의 empty paint 후보

실제 ListTile의 기본 투명/무테 배경은 그림이 비어 있는데도 매 paint마다 ink 참조 변환을 계산했다. 사적으로 만든 불변 empty decoration 하나를 공유하고, 정확한 InkDecoration owner만 이 paint를 생략하는 후보를 구현했다. Ink Widget/State·feature 등록/제거·configuration·동등한 decoration/painter 재사용은 유지한다. 명시한 색·사용자 shape/decoration·custom InkDecoration subclass는 일반 경로다. 이 소스는 §8.10의 Material archive에 **포함되지 않으며**, 현재 Material archive는 `73cd0b0d15ebbe7997d4c2e80ec45f4d90059f83c5b8021f2cb2e3bf0d511d46`다. Core archive는 §8.10 후보와 같다.

Material build·Windows/Web/Android 세 설치 공급, 신규 회귀 **3 PASS**·전체 디자인 **263 PASS**·paint **104 PASS**·타입 **10 PASS**다. 독립 명시적 투명 구성과 direction/selected/subtitle 조합 **8개**의 실제 CanvasKit 전 픽셀을 대조했다. opaque/custom shape/default 갱신 중 State/Element/feature 유지·tap/feedback, 정확한 owner의 geometry 생략과 명시적 동등 decoration·custom subclass 일반 경로, 최종 dispose·canvas balance도 확인했다.

같은 §8.10 대조군/조건에서 각 모드 **3회**, 총 **6회**의 fresh process 비교를 완료했다. 각 표본의 median [min~max]와 n은 아래와 같다. timed phase에 빌드/프로파일링을 겹치지 않았고 모든 실행은 정상 exit0이다.

| 모드 | retained p95 ms | cold p95 ms | revisit p95 ms | fast max ms |
|---|---|---|---|---|
| bytecode | 5.589 [5.439~5.910]; n=153/154/154 | 13.460 [13.430~14.082]; n=166/166/163 | 14.050 [13.341~14.105]; n=172/173/172 | 92.088 [87.067~104.494]; n=20/21/19 |
| static-aot | 5.019 [4.948~5.100]; n=154/154/154 | 12.369 [11.988~12.410]; n=178/171/171 | 12.443 [12.061~12.908]; n=180/170/179 | 98.433 [83.297~99.891]; n=21/19/20 |

대조군 대비 cold/revisit median 감소는 bytecode **25.54%/13.26%**, Static **19.94%/11.96%**다. bytecode cold만 median 25% 목표를 넘었으며 나머지 cold/revisit와 모든 fast max<50ms는 미달이다. W18-02 전체 선택/완료·R3·성능 수락으로 승격하지 않는다. 진단 HBC `24e711dc7af6305efa5b6f3615b5f15e92ff04fa8cfec6e1411ae4addaeb949f` / Static unit `14eaf9b3d93dde8e8fc22d65c65a8358b015f3bb897602156d78a5acc774acf1`, host/VM/source는 §8.7과 같다. package153/156 files·loaded79/80 modules·RN/Node-API JSI 미로딩을 확인했다.

**revisit 원인 분리:** 기존 `profile-list-creation.mjs --cache-revisit`에 실제 ListView·폰트·같은 viewport의 11단계 정방향/11단계 역방향 진단을 추가했다. Node/CanvasKit에서 cold는 hits63/misses21, revisit는 **hits72/misses0/cache-only hits18**이었다. resident39는 기존64-entry budget 안에 있고 units259/bytes133538가 revisit 후에도 같았다. tree/library close 뒤 paragraph/font 반환을 확인했다. 이는 native 시간/메모리 수락이 아닌 원인 진단이며, 이 결과로 paragraph cache 용량을 늘리지 않았다. 다음 구조 검토는 행의 생성·퇴장·재진입 owner에 집중한다.

**현재 플랫폼 공급:** Web check/build·실제 Chrome 입력 회귀 **3 PASS**다. JS `4cd7618e2d9276f7185ab1250b58d4060427adfd43b7a507843d7e45e9984ea6`, map `a237e6decbac24d069e6899dbc7d4b44ea73413b747d2380ee2dbb196653d359`, CanvasKit JS/wasm은 기존 공급과 같다. CDP는 물리 IME 수락이 아니다. Android x86_64 Release/emulator-vulkan 빌드 **PASS-scoped**(1m43s), APK `24eea658fae888f1bc126077113df8e98c6ab10eb1ef0a1224a11edf6ed73d87`다. process-local Temurin21·기존 compiler policy를 사용했고 연결 기기 runtime·production signing은 `notVerified`다. 두 Windows 제품의 재빌드·현재 실행 확인은 §8.12에 기록했다. 이전 §8.7 제품 hash를 새 소스의 실행 증거로 쓰지 않는다.

### 8.12 IN_PROGRESS — flags/empty ink의 현재 제품 공급

§8.9/8.11 소스의 두 Windows 제품을 각각 재빌드했다. package153/156 files와 현재 runtime **859 modules / 11 owners / generated 제외3**가 실제 source/owner manifest와 일치했다. Static은 nativeFunctions **37,115**·전체 앱 native image이며 전 body의 실행을 뜻하지 않는다. 각 모드를 7초씩 실제 실행해 최초 frame·`Responding=True`·유효 HWND/`Nelyx Testbed · direct Hermes` 제목·5 surfaces·정상 exit0/forced=false/error=null/stderr 빈 문자열을 확인했다. loaded79/80 modules에 RN/Node-API JSI runtime이 없다. Static 제품에 app.hbc는 없다.

| 현재 제품 파일 | SHA-256 |
|---|---|
| 공통 NelyxHermesHost.exe | `52b1e8c912062e6b0a51fe87816c72fe71fc478dbeb6147ce92276b3273448b9` |
| 공통 hermesvm.dll | `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696` |
| bytecode app.hbc | `7dba81f6edf9068b22f6c28be677e76bd07d05a78e9c603a758a5b2c968385cd` |
| Static NelyxApp.aot.dll | `41d881201af7344836c8b27d1b42ae6e42df3b89e68811c8bf73cfb4a0a265ea` |

host source identity는 §8.7의 `fe4a092da4a8a283c697acb222ca6a3d0b9d40446a1189a59279e45092596f71`이다. Core/SDK/Skia native·Web/Material/Cupertino의 source-map 입력 **6 packages / 1125 emitted modules PASS-scoped**, flags 두 파일·empty ink 세 파일의 source/dist **10개**는 세 runner 설치본과 byte가 같았다. Core flags source/dist는 `5cb7b71cb57b1626ac658b945713111157499a0fed685acf77598adcb6b6ab9c` / `086b832b0ce26c329392feb4b7c8eeac955042ca11ab01f0fe442437550bf222`, configuration은 `e4839ed3b3dae6733472c1932e4bc3ffd62a1bc87aad54972a93b0ec5809792d` / `1a1afb01d1b20c4f0efec2ad96c77a1d4e459bcd92fd5f9d56f69618d6e6726f`다. 제품의 시작/공급 증거이며 §8.11 성능 미달과 R0~R7의 미수락 경계는 그대로다.

다음 W18-02 후보는 실제 구조 변경이 있을 때만 render owner를 admission하는 reconciliation transaction이다. 현재 모든 Element mount/rebuild가 같은 render owner를 중복 admission하고 빈 leaf도 projection을 검사하는 원가를 분리한다. custom Element의 동기화 확장점·GlobalKey/지연 sibling 생성·오류 복구를 보존한 뒤 실제 cold/revisit 효과로 판정한다. W18-03 전체 교체 완료로 먼저 처리하지 않는다.

### 8.13 REJECTED / REMOVED — render 구조 변경의 transaction admission 후보

기본 framework Element의 자식 출력은 실제 render attach/move/remove로 변경 사실을 이미 알 수 있다. 이 경계에서 owner를 admission하고, canonical Element의 단순 mount/rebuild 중 같은 owner에 중복 admission하는 경로를 줄였다. 최초 render owner 검사는 유지한다. exact framework Element/owner에만 적용하며 subclass의 가상 projection·custom synchronize 확장점은 기존 경계다. 이동 전 admission, 제거 실패의 finally admission으로 예외 복구·재시도를 유지한다. snapshot·트리의 mutable 기준을 추가하거나 State/Element를 pool로 재사용하지 않는다.

Core build와 reconciliation **16 PASS**다. 신규2개는 실제 기본 render Element에서 지연된 sibling 생성·중간 component 깊이 변경·GlobalKey 이동/retirement, render attachment hook이 없는 custom 가상 projection의 교체/제거를 확인했다. 기존 custom sync·ParentData·실패 owner 재시도·falsey teardown·build scope 이동 검사도 통과했다.

첫 전체 회귀의 scroll171·디자인263·편집98·접근성88·타입10은 통과했지만 paint는 **102 PASS / 2 FAIL**이었다. 두 실패는 크기만 바꾼 rebuild에 private commit 오류를 주입하거나 수동 RenderObject 순서 변경의 자동 복구를 기대한 검사다. 이 구조 변경에서 해당 무변경 commit을 더는 요청하지 않는 계약을 영문/한글 README와 API 설명에 명시했다. 실제 child 삽입으로 오류를 주입하도록 첫 검사를 이전했고, 두 번째는 보강한 공개 `syncRenderTree()`의 명시적 owner admission을 통해 같은 정규화 오류·dirty retry·최종 순서/idle을 검증한다. 실패를 숨기거나 retry/오류 기준을 완화하지 않는다. 이 수정의 Core 재빌드·paint/회귀 재확인·새 공급/두 Hermes 비용 비교는 진행 중이며, §8.12 제품/플랫폼은 이 변경 전의 마지막 검증 공급이다. W18-03 전체 이전·W18-02 선택 완료로 처리하지 않는다.

보강 후 paint **104 PASS**·scroll **171 PASS**·layout **7 PASS**다. 같은 한 frame의 Node sampled allocation은 **10,351,760bytes**였으며 Hermes 수락 지표가 아니다. 세 runner에 현재 Core를 다시 공급했다. bytecode **1회** 진단은 retained152/cold173/revisit175/fast20 frames, callback wall p95 **5.378/14.301/13.178/101.830ms**, cold/revisit p99 **16.004/18.498ms**, fast max **101.830ms**다. viewport487×464.5/scale2·접근성 on·기존 cache·1000행/80px·동일 programmatic 거리, timed phase에는 다른 빌드/프로파일링이 없었다. HBC `67d77fdc351903c94112b1909d89b5817a521d697b799bbd21b901e95b8a50f4`·host/VM/source는 §8.12와 같고, package153 files·loaded79 modules·684 surfaces·정상 exit0이다. §8.11보다 revisit는 낮았으나 cold는 높았고 25%/R3 목표도 미달이다. Static 1회 진단 뒤 구조 복잡도에 비해 이득이 충분한지 판정하며, 유리한 한 phase로 채택하지 않는다.

Static 1회는 retained154/cold172/revisit175/fast19 frames, callback wall p95 **4.999/12.919/12.243/90.066ms**, cold/revisit p99 **15.090/21.000ms**, fast max **90.066ms**다. native unit `c7394a86fbbc2e4685385d47b5d57a9d97d7d352e9dabc92bc3b63287daa5205`·package156 files·loaded80 modules·671 surfaces·정상 exit0이며 같은 host/VM/source/입력 조건을 유지했다. 양 모드에서 cold가 §8.11보다 높고 전체 목표도 미달이므로 **미채택/제거**했다. constructor flag·admission 분기·이동/제거 admission·명시적 sync API 보강·그 README 계약·오류 주입 검사 이전을 원복했다. 일반 reconciliation 출력/가상 projection 회귀2개는 기본 경로의 독립 coverage로 남겼으며 기존 paint 오류 재시도 검사도 원래 조건으로 다시 통과했다. 시제품 수치와 검사 범위를 현재 제품 수락으로 사용하지 않는다.

### 8.14 IN_PROGRESS — 제한된 dormant row owner 후보

revisit의 문단 cache miss가 0인 §8.11 진단을 바탕으로, 다시 필요한 행의 Element/State를 분리해 보유하는 owner를 구현 중이다. `childPolicy: {mode:'dormant',capacity:32}`를 명시적으로 선택하며 기본 legacy와 기존 bounded keep-alive는 유지한다. 기존 cacheExtent를 바꾸지 않는다. builder는 재진입 때 다시 호출하고 새 Widget을 적용한다. 실제 detach/deactivate로 paint/hit/semantics·dependency를 제거하고 framework ticker는 별도 mute owner로 잠근다. activate는 현재 inherited scope를 조회하고 elapsed wall time으로 ticker를 재개한다. 앱이 제공한 GlobalKey가 포함된 행은 기존 frame-end retirement/retake 창을 유지한다. Ink와 control semantics의 사적 anchor만 factory의 약한 brand로 구분하며, 추출 시 실제 Element를 먼저 이동하고 dormant 나머지를 반환한다.

BuildOwner의 기존 inactive root가 수명 기준이며 cache는 root/index·회수 정책만 기록한다. View당32 roots/4096 Elements·sliver별1~32의 LRU 상한, delegate 교체·압박·View close의 반환을 갖는다. `ResourceRegistry`의 bounded reclamation은 reentrant 호출을 막고 뒤의 owner도 회수한다. 문단 입장은 serialization 이후 optional owner/idle cache를 회수한 실제 수치로 다시 검사하며 원래 하드 한계·frame lease 비용을 완화하지 않는다. 사용자 timer는 State lifecycle의 책임이며 새 수명 계약/사용법을 기존 Core README에 반영했다.

첫 Core build·새 dormant4/pressure2와 기존 budget6의 **12 PASS**다. State 재활성화·새 builder 결과·Ticker 정지/재개·보이지 않는 semantics·GlobalKey 제외·두 목록의 View 공유 한계·delegate 무효화·falsey dispose 뒤 나머지 owner 회수·독립 frame lease·serialization1회·실패 후 hard admission 유지가 확인됐다. 첫3개 실패는 test의 host `name` 필드, 아직32 roots를 채우지 않은 입력 수, AggregateError의 중첩 경계였으며 해당 입력/검증을 바로잡았다. 전체 source/build/회귀·실제 앱 이전·세 설치 공급·native 비용은 아직 미검증이다. 현재 설치본은 §8.13의 미채택 후보이며, 다시 공급하기 전 최신 소스의 실행 증거로 쓰지 않는다. §8.12가 마지막 제품/플랫폼 검증 공급이다.

현재 Core/Material build와 전체 scroll **182 PASS**, paint **104 PASS**, layout **7 PASS**, 디자인 **264 PASS**, 편집 **98 PASS**, 접근성 **88 PASS**, workspace 타입 **10 PASS**다. source 경계는951 files/7769 runtime edges·design cycles0 PASS-scoped이며 Core 등을 포함한21 cycles는 별도 보고로 남긴다. 신규 dormant8·압박3·실제 Material 픽셀1 검사는 notification 차단/최신 inherited scope·anchor 추출·indexed anchor와 활성화 오류 복구·실제 문단 입장 시 회수·explicit keep-alive·4096 초과 행 거부를 포함한다. Material은 LTR/RTL×선택/미선택의 두 경로 **8개 구성**에서 전체 pixels가 같았고 마지막 실제 재진입 행의 최신 tap callback을 확인했다. 앞선 tap의 hover가 다음 recipe의 keep-alive를 바꾸지 않도록 입력은 마지막 pixel recipe 뒤에 수행한다.

실제 Testbed ListViewPage는 이 정책32를 사용하도록 한 줄 이전했다. itemCount1000·80px·기본 cacheExtent·화면/입력 거리는 유지하며, 이를 의도한 보유 정책 변경으로 구분한다. Node/CanvasKit의 같은22단계 진단에서 cold dormant18 roots/1008 Elements, revisit21 roots/1176 Elements·hits18/evictions0을 관측했다. 문단 revisit72 hits/0 misses, native 수락과 별도다. tree/library 종료 뒤 paragraph/font0을 확인했다. 현재 세 설치본의 Core/Material 공급은 통과했고 마지막 문서 설명의 Core 재공급 뒤 native 비교를 시작한다. 최신 두 제품·Web/Android 재검증과 정규 비용/메모리 수락은 아직 남아 있다.

현재 공급 Core `019b3b79a21aca9307b4b6e896a189a60f83995c8bb16d72442f7dd359341911` / Material `913e6cec087db4be7f67b4920c377f3e22f0c275c2952ae925f85d570798ac9c`에서 두 모드 각3회, 총6회 비교를 마쳤다. §8.10 대조군과 창487×464.5/scale2·접근성 on·입력/데이터/기본 cacheExtent는 같고, dormant 보유32는 의도한 후보 구현 변경이다. 각 process는 정상 exit0이며 timed phase에 빌드/프로파일링을 겹치지 않았다.

| 모드 | retained p95 ms | cold p95 ms | revisit p95 ms | fast max ms |
|---|---|---|---|---|
| bytecode | 5.606 [5.586~5.624]; n=153/154/154 | 13.856 [13.128~14.895]; n=166/168/159 | 12.617 [11.784~13.013]; n=178/178/181 | 108.633 [106.704~124.189]; n=20/20/21 |
| static-aot | 5.000 [4.923~5.010]; n=154/154/154 | 12.116 [11.793~12.782]; n=173/174/168 | 10.584 [10.379~11.319]; n=188/185/183 | 96.115 [85.096~104.163]; n=22/23/21 |

cold/revisit 감소는 bytecode **23.35%/22.10%**, Static **21.58%/25.11%**다. Static revisit만 median25%를 넘었으며 나머지 cold/revisit와 fast max<50ms는 미달이다. retained는 모든 trial에서 대조군 대비10% guard를 충족했다. 전체 선택·R3·성능 수락으로 처리하지 않는다.

두 모드/각3회 모두 cold18 roots/1008 Elements·revisit21 roots/1176 Elements와 hits18을 확인했다. fast는32 roots/1792 Elements·hits39로 제한됐고 evictions는 bytecode81/77/81, Static84/86/86이었다. 활성 tree는retained1466/662→cold1634/731→revisit1466/662 Elements/render objects로 동일했다. HBC `3e461034f884c32ce7c0be48edde6669fcbcb7fafe62fab40ce82e99ee740964` / Static `c941a22100b9f5e51c2c9394d5b6f69a6ab02a1acb9ff40f01388f00f7414b70`, host/VM/source는 §8.12와 같다. package153/156 files·loaded79/80 modules·RN/Node-API JSI 미로딩·native 정상 close를 유지했다. frame 수가 다른 phase 총 VM 할당으로 개선율을 만들지 않는다. 제품/플랫폼의 최신 재빌드와 physical/driver/압박 전체 수락은 남아 있다.

다음 최소 후보는 읽기만 하는 semantics configuration의 private 기본 필드를 공유 annotation record로 보유하고 첫 실제 변경에 materialize하는 구조다. 공개 필드/메서드·callback 순서·copy/absorb·frozen configuration의 실패/부분 변경을 보존한 뒤 다시 비용을 판정한다. 아직 이 record를 위6회 공급에 포함하지 않았다.

### 8.15 REJECTED / REMOVED — semantics annotation owner 후보

`SemanticsConfiguration`의 private 기본 필드42개를 소유 record로 모으고, canonical default flags를 쓰는 읽기 전용 configuration은 하나의 동결 기본 record를 공유한다. 실제 값 변경에서 독립 record를 만든다. 공개 locale/child-policy 필드와 action table의 기존 소유권은 유지한다. 생성자는 현재 `SemanticsFlags.none`을 한 번 캡처하며 외부 subclass/Proxy·다른 default identity는 독립 record로 처리한다. 전역 기본 record에 외부 flag 객체나 callback을 보유하지 않는다. 할당을 피한 같은 값 쓰기도 owner pointer를 다시 써서 frozen configuration의 기존 실패를 유지한다.

첫 접근성 검사는 node의 module-local friend view가 이전 action-bit 위치를 읽어서 실패했다. 이 소비자도 같은 record를 읽도록 이전한 뒤 semantics29·접근성91·Windows semantics12·scroll184·paint104·디자인264·편집98과10 workspace 타입 검사가 통과했다. 새3개 회귀는 frozen/sealed/preventExtensions, 복사·absorb 독립성, signed-zero scroll/index, 실패한 action 교체의 기존 부분 변경, configuration마다 default flags를 한 번 캡처하는 동작을 검증한다. 기존 가상 Flags/Proxy·geometry/action retirement 검사는 그대로 유지한다.

이 시제품의 semantics source SHA-256은 `61d2141b01e145309de1fa9adae069858ae3901e939b9a8782e6cc099c33b942` / dist `340c95cf5a4e63a5cc9718aa8341bb8145b6dd1143a381823fa37e5613d54383`, Core archive `40d67aedeb0981a3199f03c4fb056be7dc210e8f020b12abe7d5d3b812c484e2`였다. 실제 ListViewPage의 한 far frame Node sampled allocation9,603,368bytes는 원인 진단만으로 사용했다.

같은 조건의 첫 bytecode 진단은 retained154frames p95 **5.740ms**, cold168frames **13.939ms**, revisit175frames **13.162ms**, fast19frames max **133.876ms**였다. §8.14의3회 median 대비 cold/revisit가 개선되지 않았고25% 목표·fast<50ms도 미달이다. 한 번의 진단을 정규3회 비교에 합치지 않으며 Static/추가 반복으로 확대하지 않았다. HBC `4515cf77750b603c1c13156bcf75df1ce670509c0d5b884b1e9d13f0302cb0cc`, PID5256, package153files, surface672, 정상 exit0이다. cold/revisit의 dormant18/21roots·1008/1176Elements·18hits는 같은 실제 재사용을 확인했다.

추가 간접 접근을 유지할 근거가 없어 record·helper·friend view 이전을 전부 제거하고 이전 semantics source `e4839ed3b3dae6733472c1932e4bc3ffd62a1bc87aad54972a93b0ec5809792d`로 정확히 복구했다. Core 재빌드·semantics29가 통과했고 새3개 일반 호환성 회귀만 남겼다. 현재 런타임 후보는 §8.14 dormant owner이며 그6회 비용·§8.12의 마지막 제품/플랫폼 공급과 구분한다. W18-02와 전체 작업은 계속 PARTIAL이다.

### 8.16 IN_PROGRESS — batch recording의 중간 Canvas 제거

§8.15 제거 후 현재 dormant 공급에서 bytecode PC sampling을1회 수행했다. cold651·revisit660·fast577 observations이며 **관측 가중치를 CPU milliseconds로 환산하지 않는다**. cold의 `finishLayer` inclusive50 / `freezePaintCommand` inclusive41, revisit의 `finishLayer` inclusive47과 native replay35 self가 남아 있었다. sampling HBC `d458f0c640159377e9a581791d3c9de67b75055eb3f38c852b3de4d73c8ccaa0`, PID11780, 정상 종료다. 이 intrusive 결과는 §8.14 정규 시간 비교에 합치지 않는다.

`finishLayer`는 이미 Canvas에서 캡처한 batch를 새 PaintingContext/Canvas에 한 번 replay하고 그 임시 recording을 다시 Picture frame으로 캡처했다. 새 내부 경로는 batch를 검증·독립 캡처하는 Picture로 직접 만든다. 입력 recording의 hold는 assembly/rollback까지 유지하며 Picture/frame은 독립 hold를 가진다. 공통 frame 캡처기의 원래 consume 계약은 유지하고 내부 borrowed capture만 입력을 소비하지 않는다. 외부 command·geometry·token·수량/bytes/layer budget 검증, image/shader hold·오류 aggregation, Picture 생성 callback·실패 rollback을 유지한다.

Core 빌드·paint107(기존9개 실제 CanvasKit pixel recipes 포함)·native replay25·scroll184·디자인264·10 workspace 타입 검사가 통과했다. 새3개 회귀는 여러 frame과 원본의 독립 수명, partial validation/falsy cleanup failure 이후 원본 보존, Picture callback의 falsey 실패 뒤 이전 scene 보존과 재시도를 확인한다. 첫 bytecode 진단은 retained153frames p95 5.525ms, cold164frames14.050ms, revisit181frames12.305ms, fast22frames max90.371ms였다. HBC `f48af4cf33b2985f7f94e5504e2f58d7a88b6b723f2f6e62e152df9de9b7082d`, PID25160, 정상 종료다. 이1회는 정규3회 결과로 승격하지 않는다.

현재 Core archive는 `37704a11d878428f139c9345fe82705b43e3f04428f4e43822103490d86e8166`이며 세 runner에 설치했다. source(frame/Picture/context)는 각각 `4f191ba27acd3cdd8d6b832e8d40100b8ca4a19f7c3872c13850aee318e52a20` / `d33f375356948fb0c0326142647683b55d8c3cc13ff3d341ceda51e1507afce5` / `f0dd55c885f81efa7d1151615a18e158b6862795e6adf66afeb79d233f44af83`다. 다음 §8.17의 실제 스타일 조립 원가를 같은 후보에 더해 판정한다. W18-02/06 전체 선택·제품/성능 수락 전 시제품이다.

### 8.17 IN_PROGRESS — ListTile 기본 스타일 projection 소유

한 행마다 `ListTileThemeData`·padding/shape·기본 Color를 재생성하던 경로에 live Theme별 최근 불변 projection 하나를 둔다. 공개 style getter/copyWith와 색 getter를 **조회 이전에 원래 순서대로 매번 실행**하고, 캡처된 TextStyle identity와 primitive 색 값이 같을 때만 이전 값을 재사용한다. 외부 스타일/색의 동적 값·오류는 일반 평가를 거친다. WeakMap은 Theme·Widget/State·BuildContext를 전역 강한 목록에 보유하지 않으며 각 live Theme의 최신1개만 남긴다. native resource·frame lease를 추가로 소유하지 않는다.

기존 role getter 순서·copyWith accessor 검사를 유지했다. 새 회귀는 같은 Theme의 스타일/색 변경, 이전 출력의 불변성, 여러 재사용 뒤에도 custom copy hook9회 실행, falsey 색 getter 오류와 읽기 중단을 확인한다. focused tile/empty ink/dormant pixels14개가 통과했다. Material source `0a452bca2635fa74c393c6ad4726923b44c6531ccedf99c0b4d4d8ae94ed98e1` / dist `44565ee0bb04f7ae6e9027a70641b10b53e3bfa871c343f3fd214f960faf9f29`, archive `3216242ab16eecbd92999e1d7999a46ad12bb6ae01d625ed05a7c8429572da57`다. Windows에 설치한 뒤 Web/Android의 같은 공급을 진행 중이다.

§8.16과 결합한 첫 bytecode 진단은 retained154frames p95 **5.711ms**, cold168frames **13.551ms**, revisit178frames **11.933ms**, fast18frames max **109.177ms**였다. cold/revisit가 §8.10 대조 median 대비25%를 넘었으나 cold는 경계에 가까워 채택으로 먼저 판정하지 않는다. HBC `d32226426c186ecfa1cc1d14ed5f90a547b6c3ffcb0291c910469e1646b118e9`, PID17284, 정상 종료다. 같은 공급의3회와 Static Hermes로 확인하며 **fast<50ms·전체 R3는 계속 미달**이다. 전체 디자인·타입 확인과 현재 두 모드의 정규 비교 전 W18-02 선택/완료로 처리하지 않는다.
**위 첫1회와 분리한 정규6회 결과:** 두 모드별 같은 package에서 새 process3개씩 실행했다. 전체 디자인265·10 workspace 타입 검사와 세 runner의 같은 설치가 통과한 뒤, 다른 빌드/프로파일 없이 측정했다.

| 모드 | phase | trial1/2/3 (ms) | median | 대조 median 대비 감소 |
|---|---|---|---:|---:|
| bytecode | list-retained p95 | 5.412 / 5.446 / 6.559 | 5.446 | 22.65% |
| bytecode | list-cold p95 | 13.461 / 14.496 / 13.907 | 13.907 | 23.07% |
| bytecode | list-revisit p95 | 12.267 / 11.495 / 12.387 | 12.267 | 24.26% |
| bytecode | list-fast max | 86.879 / 99.392 / 94.970 | 94.970 | 22.11% |
| static-aot | list-retained p95 | 5.146 / 4.858 / 5.233 | 5.146 | 20.80% |
| static-aot | list-cold p95 | 12.853 / 12.202 / 12.200 | 12.202 | 21.02% |
| static-aot | list-revisit p95 | 10.544 / 11.790 / 10.623 | 10.623 | 24.83% |
| static-aot | list-fast max | 120.321 / 102.661 / 80.287 | 102.661 | 0.15% |

정규 cold/revisit median은 bytecode **13.907/12.267ms**, Static **12.202/10.623ms**다. 네 구간 모두25% 조건을 충족하지 못했으며, 초기1회만 고르는 방식으로 선택하지 않는다. retained의 각 paired trial 10% guard는 통과했지만 모든 fast max는50ms를 넘었다. **W18-02 선택/완료·R3·performanceAccepted는 계속 미달**이다. bytecode HBC `d32226426c186ecfa1cc1d14ed5f90a547b6c3ffcb0291c910469e1646b118e9`, Static DLL `4660f188fa852c2b0f722a646601a60086ca541fb1b2dde0c8e1994e1beecad1`; PIDs26304/29112/7208 및3116/1424/6504 모두 정상 종료다. 현재 두 owner 변경은 추가 구조 비교 전의 시제품이며 최종 제품/플랫폼 공급은 여전히 §8.12다.

### 8.18 IN_PROGRESS — glyph definition의 최근 불변 스타일 소유

같은 IconData·크기·색·weight·font axes에도 매 행 생성하던 glyph TextStyle과 뒤따르는 copy 입력을 재사용한다. Nelyx가 직접 생성한 동결 IconData만 identity로 인정하고, 그 live definition마다 최근 스타일1개만 WeakMap에 둔다. 크기/색/축의 조합 이력을 누적하지 않는다. Color·IconData member를 기존 순서로 먼저 읽고, FontVariation도 각 실제 축 값을 검증·캡처한 뒤 비교한다. caller fallback/shadows·Paint·비소유 typography·Proxy는 일반 생성 경로다. TextStyle 생성이 읽는 공개 font-family-fallback getter가 교체되면 재사용을 중단한다. Widget/State/Element identity와 Controller·Ticker·native 자원/문단 lease를 보유하거나 재활용하지 않는다. 순수 스타일의 보유 수명은 live glyph definition의 최신1개이며 교체·weak key 회수에 따른다.

첫 조건은 빈 axis 목록만 인정해서 실제 기본 IconTheme의 FILL0/wght400/GRAD0/opsz48 네 축에 적용되지 않았다. 해당 진단은 bytecode retained154frames p95 5.633ms, cold168frames13.553ms, revisit185frames11.898ms, fast21frames max96.927ms였으며 **glyph 재사용 효과로 해석하지 않는다**. HBC `19739dacd5bf3a7b42f22d0dd39d1a89a0224d8a5728d12080ed9acef3fdcb70`, PID26616, 정상 종료다. 이후 소유 FontVariation의 순서/axis/value를 전부 비교하도록 조건을 고쳤다.

현재 Core 빌드와 glyph/style21개가 통과했다. 새4개 회귀는 반복 glyph의 live Color 호출과 이전 값 불변성, 네 축·size 갱신, borrowed fallback 변경과 Proxy 읽기 순서, warm 재사용 뒤 constructor getter 교체를 검증한다. 기존 실제 CanvasKit glyph pixels·dry/baseline/hit/semantics·key/render owner·GlobalKey 이동·paragraph retirement 비교는 유지한다. 실제 ListViewPage far frame의 Node sampled allocation9,322,552bytes는 원인 진단이며 Hermes 성능 수락 근거가 아니다.

source Icon `d3a98be22d994045e31ed129629b3b9e108ffe2eba0fd022f75f727ecfb1e2b9` / dist `bb6b858a8594f9ed99f5cebb8cb01eaf00052ad404e29ce7e52228291abab4dc`, IconData source `5c069f7556346b53e6236d671f0667086296e8b891f8414bfa98f77df7b87816`, TextStyle source `30f82df35b0d9a91a8798bba209c304a400ed0128049191893388407e72e10a8`다. 수정된 조건의 전체 디자인/타입 확인·Windows 공급과 새 비용 비교를 진행 중이다. Web/Android 설치와 마지막 제품은 이전 cohort로 구분하며 W18-02 선택/완료 전이다.

현재 조건의 디자인265·10 workspace 타입 검사가 통과했고 Core archive `430934dadbafa3125e2cae01e8130754be25471d60bd3b3065e30e65508efd2a`를 세 runner에 설치했다. 첫 bytecode 진단은 retained153frames p95 **5.682ms**, cold168frames **13.368ms**, revisit181frames **11.747ms**, fast21frames max **94.584ms**였다. HBC `08f01ff90a1abcea58352d38115ed3d0e4d952fe042c206577e534ec31d7b7d2`, PID18312, 정상 종료다. 이1회는 정규 비교가 아니다.

뒤이은 정규 묶음은 첫 trial의 **foreground 획득 실패**로 phase 시작 전에 exit1로 종료됐다. 같은 HBC·host/VM identity·FIRST_FRAME·surface5까지 확인했으나 유효 phase/완료 run은0개다. 결과를 시간 비교에 포함하지 않고 Static 후속 실행도 하지 않았다. 실행별 임시 fixture는 finally에서 정리됐다. foreground 조건을 다시 확보한 뒤 정규 비교를 이어가며, 현재 제품/플랫폼의 마지막 수락 범위는 여전히 §8.12다.


**Foreground 재시도 후 정규6회:** bytecode/Static 각각 같은 공급의 새 process3개로 완료했다. 첫 foreground 실패 실행은 제외했다. 다른 빌드·프로파일을 병행하지 않았다.

| 모드 | phase | trial1/2/3 (ms) | median | 대조 median 대비 감소 |
|---|---|---|---:|---:|
| bytecode | list-retained p95 | 5.601 / 5.796 / 5.779 | 5.779 | 17.93% |
| bytecode | list-cold p95 | 13.933 / 15.092 / 12.701 | 13.933 | 22.92% |
| bytecode | list-revisit p95 | 12.210 / 12.478 / 11.725 | 12.210 | 24.61% |
| bytecode | list-fast max | 94.650 / 105.460 / 101.901 | 101.901 | 16.43% |
| static-aot | list-retained p95 | 4.963 / 4.917 / 4.998 | 4.963 | 23.62% |
| static-aot | list-cold p95 | 12.323 / 11.575 / 11.979 | 11.979 | 22.46% |
| static-aot | list-revisit p95 | 10.780 / 10.816 / 10.590 | 10.780 | 23.72% |
| static-aot | list-fast max | 82.762 / 88.455 / 88.073 | 88.073 | 14.34% |

네 cold/revisit median은 모두25% 최소 조건에 미달했다. retained 각 paired trial10% guard는 통과했고 모든 fast max는50ms를 넘었다. **W18-02 선택/완료·R3·performanceAccepted=false 상태를 유지한다.** HBC `08f01ff90a1abcea58352d38115ed3d0e4d952fe042c206577e534ec31d7b7d2`, Static DLL `4122756757e505faeb8987e6e716c56b8119449e9c3f0096a7ef2351d35f6f9a`; bytecode PIDs19064/5948/21340 및 Static PIDs30564/3632/7620는 모두 정상 exit0다. host/VM은 §8.12와 같고 RN runtime·Node-API JSI가 없다. 현재 세 runner의 Core/Material 공급은 같지만 이 diagnostic image를 실제 제품 빌드·Web/Android runtime 수락으로 해석하지 않는다.

### 8.19 IN_PROGRESS — owner가 모으는 semantics configuration commit

반복 paint/속성 변경마다 configuration 생성·사용자 descriptor 평가·조상 탐색을 즉시 반복하던 경로를 View pipeline의 pending configuration 집합으로 옮겼다. 기존 fragment의 입력은 요청 때 무효화하되 실제 재평가와 dirty boundary 결정은 layout 뒤 semantics flush에서 수행한다. 새 render child는 부모의 구조 갱신에서 처음 방문할 때 fragment를 만들며, 제외된 private/hidden 자식을 attach만으로 materialize하지 않는다. pending은 같은 render당1개이며 detach·root 교체·owner disable에서 회수한다. Widget/State·builder/lifecycle·layout/hit/편집의 소유권은 변경하지 않는다.

**명시적인 callback 계약 변경:** 이전에는 attach/반복 mark 중 `describeSemanticsConfiguration`과 transport getter가 동기 호출될 수 있었지만 이제 commit에서 최종 상태를 평가한다. descriptor의 앱 부작용을 attach/detach/State lifecycle로 옮기는 안내를 Core 영문/한국어 README에 함께 적었다. 기존 callback-getter 실패 검증도 이 의도된 시점 변경에 맞춰, host callback 오류 뒤에도 queued descriptor가 commit에서 실패하고 재시도되는지 확인하도록 이전했다. ancestor의 일반 getter를 소유한 값으로 간주하거나 장애를 숨기는 빠른 경로는 추가하지 않았다.

descriptor는 성공 후에만 새 configuration을 게시하여 falsey 오류 뒤 부분 설정을 재사용하지 않는다. 실패한 pending/dirty 대상은 다음 flush에 남긴다. commit 중 재진입 무효화는 Release에서도 거부한다. 실제 설정 변경이 motion-only snapshot 간격을 우회하도록 root의 판단도 pending configuration과 연결했다. 마지막 semantic node만 퇴장한 경우 detached 집합을 비우고 빈 update/observer 알림을 한 번 게시하도록 기존 owner retirement 결함도 수정했다.

Core 빌드, 접근성95·scroll187·paint110·editable98·Windows semantics12·전체 디자인265·10 workspace 타입 검사가 통과했다. 새 실제 pipeline 회귀는 attach 지연·반복 변경의 최종 값·이전 게시 값 유지·falsey descriptor 실패 후 자동 재시도·제외된 자식의 materialization/reveal/retirement를 확인한다. 마지막 node만 제거하는 일반 packet/host-tree 두 경로도 검증했다. 실제 ListViewPage far frame의 Node sampled allocation8,830,472bytes는 진단이며 Hermes frame 개선율을 대신하지 않는다. 세 runner 공급과 실제 두 Hermes 비용은 진행 중이며 이 후보를 선택/완료로 처리하지 않는다.

현재 Core archive `122941b0154caa3206414c136ba480d34502a3287ca71ddd4019f0007d6c74d3`를 세 runner에 같은 내용으로 설치했다. 첫 bytecode 진단1회는 retained154frames p95 **5.550ms**, cold165frames **13.892ms**, revisit181frames **12.523ms**, fast23frames max **89.206ms**다. HBC `50ef71eb05745fdb604989d56e458e0658918068d58c49a372e99b03f663b80e`, PID2636, loaded host/VM은 §8.12와 같고 정상 exit0다. 이1회로25% 최소 조건이나 추가 이득을 입증하지 못했으므로 정규 비교/Static 반복을 먼저 확대하지 않는다. 현재 소스의 샘플 진단으로 병목을 다시 좁히며, callback phase 변경을 포함한 이 owner 후보는 계속 시제품이다.

소스 SHA-256: RenderObject `81b61a105289595d014a86f99b056f3f9a12c78b6d514a6982804d70a5a98ced`, semantics pipeline `e107e42d32beb258c17e2bf14e5187a9239c51329e196f67738e70a4fc1e85b7`, semantics owner `0769d29713d7041c2e70fdc6bdb667682eb481e97b433261fd8b94e47ead194d`, root `08fadac3fdc74e24e6a68a37ee6c3cf708f65f04870f71f713ea5910e72934f3`다. 마지막 실제 제품·플랫폼 실행 수락은 §8.12이며 현재 source/dist/설치를 그 이전 bundle/APK의 새 수락으로 승격하지 않는다.

### 8.20 IN_PROGRESS — replacement recording의 depth 조립 원가

§8.19 현재 소스의 bytecode PC 진단1회는 cold646관측에서 `Layer.redepthChild` self10/inclusive11, `finishLayer` self8/inclusive43을 보였다. revisit662관측은 `finishLayer` inclusive38, fast557관측은 young GC58관측이었다. 이는 PC 관측 수이며 CPU ms나 별도 성능 수락이 아니다. sampling HBC `02a1a545392204eead21dafe1b179b90410ee70adf84b93f2597a2b8acc9c1c6`, PID25288, 정상 exit0다.

새 recording body를 depth0에서 조립하면 기존 깊은 retained child를0기반으로 낮춘 뒤 최종 parent에 append할 때 다시 전체 하위 depth를 올렸다. 새 body의 사적인 `_depth`를 이전 body의 값으로 시작하여 이 임시 왕복을 없앴다. 최종 destination이 달라지면 기존 append/redepth 검증이 계속 보정한다. root compose와 child-layer repaint 양쪽에 적용했고, 추가 cache/lease/Layer owner는 없다. [Flutter depth 문서](https://api.flutter.dev/flutter/rendering/Layer/depth.html)는 부모 아래로 depth가 증가하는 순서를 요구하지만, 이번 변경에서는 기존 Nelyx의 정확한 최종 depth 값과 일반 Layer API도 보존했다.

Core 빌드·paint111·native replay/backpressure/scene와 실제 overlay anchor28개가 통과했다. 새 검증은8단계 깊이에서 root/child 두 종류의 recording을 교체하고 retained descendants의 depth가 같고 임시 subtree rewrite가0회인지, 현재 색·annotation 좌표·owner가 유지되는지 확인한다. 기존 equal/deeper/shallower reparent·follower transform·9종 실제 CanvasKit pixel 비교는 그대로 통과했다. source `Nelyx/src/framework/painting/context.ts` SHA-256 `f04998e8efb73d6b3550c4ed5c7ddb62f5ef6c5f3ee324854e4aef327a387e2c`다. 현재 Core의 세 runner 공급 및 bytecode3회 확인 뒤 Static 비교 여부를 결정한다. W18-02·R3는 여전히 선택/완료 전이다.


**현재 공급과 bytecode 정규3회:** Core archive `96b78c538810d47a039f305dc52c23c57efb33280c280d668d6097a2fb60d730`는 Windows/Web/Android 설치가 같다. 다른 빌드/프로파일 없이 같은 package에서 새 process3개를 측정했다.

| phase | trial1/2/3 (ms) | median | §8.10 대조 median 대비 감소 |
|---|---|---:|---:|
| list-retained p95 | 5.640 / 5.773 / 6.018 | 5.773 | 18.01% |
| list-cold p95 | 12.289 / 13.013 / 13.039 | 13.013 | 28.01% |
| list-revisit p95 | 11.806 / 11.025 / 11.617 | 11.617 | 28.28% |
| list-fast max | 88.306 / 90.113 / 105.745 | 90.113 | 26.10% |

bytecode cold/revisit는 median뿐 아니라 각 paired trial의25% 조건도 모두 통과했고 retained의 각10% guard도 통과했다. fast max는 모두50ms를 넘었다. HBC `9dff708b4314ecec9e8bb2f91ee7fa9bf81a092a28c5b570d584e4a1230595a8`, PIDs3456/18320/19064 모두 정상 exit0다. **Static Hermes 정규3회는 동일 소스로 진행 중이며 W18-02 전체 선택/완료와 R3 수락 전이다.** 현재 제품 빌드·플랫폼 실행 수락은 여전히 §8.12이며 새 source/dist/설치·CPU diagnostic을 제품·물리 수락으로 바꾸지 않는다.


**동일 소스 Static Hermes 정규3회 완료:**

| phase | trial1/2/3 (ms) | median | §8.10 대조 median 대비 감소 |
|---|---|---:|---:|
| list-retained p95 | 4.860 / 4.804 / 4.959 | 4.860 | 25.21% |
| list-cold p95 | 11.030 / 11.433 / 11.405 | 11.405 | 26.18% |
| list-revisit p95 | 10.193 / 10.218 / 10.301 | 10.218 | 27.70% |
| list-fast max | 84.928 / 76.625 / 87.776 | 84.928 | 17.40% |

Static cold/revisit도 각 paired trial의25% 조건과 retained10% guard를 전부 통과했다. DLL `759f470e0329f5b3cbf6d625dba54a7ddb72bca7d179ba87b7711198e3411a80`, PIDs10408/26212/19232 모두 loaded identity 일치·정상 exit0다. **두 모드의 대표 창/실제 ListView 시제품 최소 CPU 기준을 충족한 cohort다.** 할당30% 참고 목표·전체 catalog·R0~R7·최종 performanceAccepted를 이 결과로 완료하지 않는다. fast max는 Static76.625~87.776ms / bytecode88.306~105.745ms로 계속 미달한다. 현재 aggregate 선택의 제품 공급·메모리/압박·API 이전을 확인한 뒤 W18-03 이후의 전체 이전을 진행한다.

### 8.21 IN_PROGRESS — 선택 후보의 현재 제품·플랫폼 재공급

§8.20의 Core/Material 설치를 바꾸지 않고 diagnostic entry를 뺀 실제 제품을 다시 빌드한다. 이 절 이전 cohort의 bundle/APK로 새 소스를 수락하지 않는다.

- **Windows bytecode 제품:** package153files와 현재 runtime source860개/owner11개/generated3개 제외를 대조했다. HBC `39249f26302a9cbc4b77b4a1e11fd034ecba4bd71a79975c9ce3683928f293b3`; loaded host `52b1e8c912062e6b0a51fe87816c72fe71fc478dbeb6147ce92276b3273448b9` / VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`, RN runtime/Node-API JSI 없음. diagnostic/trace/profile 환경 변수를 제거한 PID5364에서 FIRST_FRAME·실제 HWND/title·Responding=true·surface5를 확인했고7초 뒤 exit0/forced=false/error=null/stderr 없음으로 종료했다. qualification은 experimental이고 전체 performance/physical 수락은 아니다.
- **Web 현재 공급:** runner check·Metro build와 실제 Chrome EditContext/CDP 입력3개가 통과했다. JS `ed37646655ecf54afad7d1f75c9052e6b105f9c08e9aad7cfae8972fb90d606b`, map `af411bbf3e93f17973a0063523c67525c02608979fa02b8b7b41a2bc6179fd2f`; CanvasKit JS `cc0c886876c07cd0a50c11b3adff344b7e069d1743ba47c2ce70b7861ee9e665`, WASM `2b9fe2ffe434b201055d122beff62f0e37865f72a86256053a0a4009c85c5f1c`다. browser/server/profile/temp install은 해당 검증의 finally에서 정리됐다. 물리 IME나 전체 native catalog 검증을 뜻하지 않는다.
- **Android 현재 공급:** runner check와 x86_64/Release/emulator-vulkan 빌드 통과, APK66,013,584bytes / SHA-256 `08c8d2cdbf58c37abf52f4077fe17b241747f0d25b6e919404b71744a4f35b59`다. 설치된 Temurin21을 자식 process 환경에만 적용했다. 현재 adb 연결 기기0개여서 device runtime·production signing은 notVerified다. 기존 Gradle deprecation/SDK XML 버전 경고는 남아 있으나 빌드는 성공했다.

Static Hermes 실제 제품은 같은 소스로 빌드 중이다. 추가 focused 회귀2개는 debug/Release의 semantics commit 재진입 거부와 실제 FrameworkRoot의 falsey descriptor 실패→이전 snapshot 유지→다음 frame 복구/옛 action 폐기를 각각 통과했다. §8.19의 전체95개 결과와 이 추가2개를 구분한다. 현재 후보의 native resource-cycle/압박·R0~R7·RNW 안정성·전체 이전은 계속 남아 있고 기본 host는 전환하지 않는다.


**Static 제품도 현재 공급으로 완료:** package156files, 현재 runtime source860/owner11/generated3개 제외가 일치한다. DLL `1b04ad944ec093bb9a1cbda413f31b9cd012c0a57cb817483aad4055abbc16b1`, native functions37,162(compile 분류이며 실행 coverage가 아님), HBC 없음. host/VM은 위 bytecode와 같고 loaded modules80, RN runtime/Node-API JSI 없음이다. diagnostic 환경 변수를 제거한 PID5864의 FIRST_FRAME·실제 HWND/title·Responding=true·surface6를 확인하고7초 뒤 exit0/forced=false/error=null/stderr 없음으로 종료했다. 두 모드의 실제 제품 source→dist→설치→bundle/native image→loaded 확인은 이제 이 절의 cohort이며 §8.12를 현재 결과로 재사용하지 않는다. Core/Material/SDK/공통 Skia의 현재 source-input 검사와 전체 git diff --check도 통과했다. native resource-cycle은 bytecode3회부터 확인 중이다.


**두 모드 resource-cycle3회도 PASS-scoped:** gallery 기준→ListView 진입/scroll→gallery 복귀를 각3회 완료했다. bytecode PID10008 / HBC `f35c2d8494d92730cd9be24a708822bcf863012e6e429a24bfed30443c3c7167`, Static PID21772 / DLL `808d70cfedc8c383dc2388f7da89d7b59496b3cbb3d1d2ded3d31b3230e86556`, 모두 같은 host/VM loaded identity·정상 exit0다. 각 복귀의 producer32 / producer units198 / producer bytes50,720, picture cached/live6/6·80,384bytes와 native counters `[1,0,1,0,0]`이 기준으로 돌아왔다. 마지막 resident94 / units637 / bytes146,436는 cache 보유로 관측했으며 process private/GPU/driver 전체 메모리 수락을 뜻하지 않는다. 이 절은 고정 설치된 Core archive96b78c…/Material321624… cohort의 결과이며, 다음 절의 workspace 변경과 구분한다.

§5.1의 두 모드·대표 창 최소 CPU/retained guard, 관련 builder/State/Key·출력/입력/수명 회귀, dormant 소유/회수 정책과 scoped3회 결과를 근거로 **W18-02의 이 aggregate를 선택한다.** 모든 개별 최적화의 독립 효과를 주장하지 않는다. W18-02의 시제품 선택 완료와 R0~R7/전체 제품 완료는 별개이며 fast·physical·전체 메모리는 계속 미달/미확인이다.

### 8.22 IN_PROGRESS — W18-03 Element·focus의 nominal 의존 방향

선택 cohort 뒤 workspace에서 `framework → focus → traversal policy → focus/framework`의 runtime SCC를 분리한다. 두 canonical 클래스의 nominal 판정만 좁은 내부 type-witness 모듈로 전달하며 생성자·Element/FocusNode identity·State/lifecycle·public import를 교체하지 않는다. binding은 declaring module마다 한 번 설정하는2개 클래스 참조이며 live tree/자원/owner registry가 아니다. `instanceof` 자체는 호출 때 수행해 public Symbol.hasInstance·receiver·Proxy prototype trap·falsey 오류를 보존한다. Element마다 필드/등록 작업을 추가하지 않는다.

Core build와 focus/control/경계9개가 통과했다. 실제 FocusNode attachment 회귀는 Proxy context의 읽기 순서, live hasInstance와 원래 receiver, undefined/null/0 오류 뒤 미부착 상태, 구조가 같은 가짜 context 거부를 확인한다. source graph 회귀는 세 owner가 runtime SCC로 다시 들어가지 않도록 검사한다. 전체 접근성/scroll/편집/디자인/타입·현재 graph를 확인 중이다. **현재 workspace/dist는 이 절의 다음 소스이며 runner 설치/native 제품/Web/APK의 마지막 검증은 §8.21 cohort다.** 새 공급·native 반복을 먼저 수락하지 않는다.


§8.22 후속 source 검증은 접근성98·scroll190·editable98·전체 디자인266·10 workspace 타입 검사가 통과했다. 현재 source graph952files/7,773runtime edges, 위반0, runtime SCC21→20이며 디자인 SCC0이다. 두 fresh ESM 순서(focus→framework→policy, policy→focus→framework)에서 legacy FocusManager 소유/요청/해제도 통과했다. 전체 R0의 다른20개 SCC를 해결했다고 처리하지 않는다. BuildOwner의 render transaction이 child-first로 dirty owner만 commit하고, 공통 RenderObjectElement는 실제 순서가 다를 때만 setChildren하며, Sliver/wheel/2D adapter는 자기 canonical slot map의 직접 갱신을 유지하는 소비 경로를 대조했다. LayoutBuilder의 공개 sync hook은 owner queue commit으로 연결되며 이전 root projection pass가 아니다.

소스 SHA-256: framework `3d7db7de950b354f967255577cd5e1588b728d805443a67ca7db14d2fbc90973`, focus `56fff5571843e78bbfffda4608ec8ccd2004856100f267bb71451053fb45d093`, traversal policy `bafbd608930944395b9576b2b898b323894b9e1858c67beb679803f69c938d54`, class identity `3e500369e85299514fd8feacd8e8fcafc67fd6c1133a05d6e08e328087a0452f`다. 이 source 변경의 새 native/플랫폼 공급은 Stage10 통합 시 다시 확인한다.

### 8.23 IN_PROGRESS — W18-04 layout admission 실패의 owner 복구

dirty batch를 먼저 큐에서 뺀 뒤 `isRelayoutBoundary` 같은 virtual getter가 던지면 현재/이후 형제 작업이 사라지는 결함을 재현했다. 이전 소스는 다음 flush에도 성공 layout 횟수 `[1,1]`에 머물렀고 기대 `[2,2]`를 충족하지 못했다. layout 본문 실패 뒤 recovery가 공개 owner getter를 다시 읽어 첫 falsey 오류를 다른 오류로 바꿀 수도 있었다.

node의 admission 검사와 실제 layout을 같은 실패 경계에 두고, recovery는 rendering library의 canonical private owner/dirty 상태로 남은 batch를 재입장시킨다. 성공 경로에 새 queue/record/배열을 추가하지 않는다. 이미 detach된 node는 재입장시키지 않으며 public getter를 cleanup 중 다시 실행하지 않는다. Root/형제 layout 순서·일반 getter의 정상 실행 순서와 기존 queue 한계는 유지한다.

Core build와 debug/Release × admission/layout 실패 × undefined/null/0의12개 경우가 통과했다. layout callback이 queued child를 detach한 뒤 실패하는 추가6개 경우도, 원래 오류 유지·독성 owner getter 미실행·detached child 미재입장·남은 branch 재시도를 확인했다. 전체 layout constraints7·scroll191·paint113개와 추가 focused1개(6가지 detach 조건)를 구분한다. 현재 RenderObject source SHA-256 `9a9b97f8a089fd0e6f150d9bdbc9fe4c42b9c15de56387db37e3eacf773a487c`다. 아직 이 단계의 전체 geometry/Sliver 이전이나 새 제품 성능·R0~R7을 완료하지 않았다. 설치/native/Web/APK의 마지막 qualified cohort는 계속 §8.21이다.

### 8.24 IN_PROGRESS — W18-05 문단의 단일 font catalog owner

문단 cache와 font provider가 독립적으로 font iterable을 방문하고 metadata·JSON key를 만들던 경로를 `hosting/text-fonts`의 `ParagraphFontCatalog`로 통합했다. 한 layout 경계에서 잡은 immutable metadata/revision을 cache와 실제 native/Web provider가 함께 소비한다. cache는 catalog JSON을 키마다 다시 만들지 않으며 provider가 두 번째 font-source callback을 실행하지 않는다. 새로운 capture가 일어나면 이전 키는 cache.key를 다시 호출하지 않아도 admission에서 거부한다. catalog 자체는 metadata만 소유하며 native 자원은 기존 문단/provider/frame lease가 보유한다.

getter/iterator의 새 실행 경계와 저수준 API 변경을 Core README 영문/한글에 반영하고 native/Web의 마지막 소비자를 함께 이전했다. font metadata는 capture 때 읽고 provider는 captured family/resource와 source의 native handle을 사용한다. 미완료 capture는 이전 revision을 바꾸지 않으며 foreign/Proxy receipt는 필드를 읽지 않고 거부한다. provider 생성 중 재진입/반환값 getter 오류는 미게시 provider를 원래 receiver로 retire하고 lease를 반환한다. retirement 중 재대여는 거부하고, retirement 미확인은 native residency를 보유한 실패 상태로 남긴다.

Core·skia-native·skia-web build, owner/cache/budget25개, scroll199개, text/style·editing-layout·native-font25개, editable98개와10 workspace 타입 검사가 통과했다. 그 뒤 추가한 native adapter 회귀를 포함한 font owner8개도 통과했다. adapter 회귀는 실제 TS NativeTextLayoutService에 controlled native port를 주어 layout마다 source1회 방문·cache hit·fallback family·old frame/provider retirement를 확인하며 C++ 실행 증거는 아니다. 실제 Skia 문단·fallback 변경·한국어/RTL·paint/query 수명은 scroll에 포함한 기존 paragraph 회귀 범위다. 새 workspace/dist와 마지막 qualified 설치/native/Web/APK §8.21 cohort는 계속 구분하며, 이 변경의 새 비용·플랫폼 공급은 아직 수락하지 않았다.

입력 경계도 대조했다. SDK View는 frame build 실패 뒤 failed로 전환하고 pointer/key admission을 거부한다. 이 근거 없이 FrameworkRoot의 hit 경로에 별도 snapshot/입력 차단 상태를 추가하지 않았다. 전체 W18-04/05/07 완료나 R0~R7 수락을 뜻하지 않는다.

공급 점검에서 NativeAssetServices가 전체 asset 바이트만 반환하고 각 NativeFont의 sourceBytes를 누락해 provider 회계가0으로 관측되던 결함도 확인했다. native font descriptor가 공통 ParagraphFont 계약을 확장하고 sourceBytes를 필수로 선언하도록 이전했으며, loader는 검증한 font input의 실제 bytes.length를 전달한다. Native asset 회귀에서 per-font와 전체 source byte를 함께 확인한다. 이는 backing-source 비용이며 실제 native allocator/GPU heap 측정으로 바꾸지 않는다. Core README에 이 API 변경도 반영했다.

### 8.25 IN_PROGRESS — 자원 identity와 frame/paint 의존 분리

ResourceRegistry가 단순 ID 문자열을 만들기 위해 frame→paint→shader→Image→ResourceRegistry 경로를 가져오던 결합을 제거했다. ID의 기존 JSON encoding을 `ui/resource-retention`의 단일 구현으로 옮기고 `ui/frame.resourceKey`는 같은 함수 참조를 export한다. Image의 registry 의존은 실제 사용대로 type-only로 고쳤고 자체 ID 문자열 조립도 같은 구현을 사용한다. ColorFilter와 effect wire의 BlendMode 목록은 Paint class 대신 기존 immutable `blend-mode-data`에서 직접 참조한다. public 값·문자열 형식·사용자 getter/JSON 호출 본문·retainer/lease는 유지한다.

Core build, paint113·native replay25·owner/경계11개가 통과했다. source graph는952files/7,774runtime edges·위반0·디자인 SCC0이며 runtime SCC20→19다. ResourceRegistry/frame/paint/Image/shader와 앞서 분리한 Element/focus가 SCC로 돌아오지 않도록 경계 회귀를 확장했다. 전체 나머지19개 SCC의 필요성/이전 검토를 완료했다고 처리하지 않는다.

§8.24 catalog의 변경 없는 capture는 기존 metadata 배열·entry를 재사용하도록 정리했다. source metadata 검증은 계속 매 capture에서 실행하고 source의 새 ResourceId capture 경계도 유지한다. 이후 owner/cache/경계20개가 통과했다. 이는 할당 경로 정리와 소스 검증이며 새 native p95 개선율은 아직 측정하지 않았다. §8.22~8.25를 함께 공급하는 다음 qualification 전까지 마지막 제품 수락 범위는 §8.21이다.

### 8.26 IN_PROGRESS — font catalog·layout·모듈 경계의 현재 제품 공급

§8.22~8.25를 묶어 Windows/Web/Android에 공급했다. 공통 Core archive `2193a24929b7eb638d80108ef691f19143d9afa1602e4b3e4d04c714e90cc584`, SDK `c2276b3f03a711c5208501eaa3e96ac1fa1cb6676acb33919d17cba1a47c35df`, native Skia `58275748c4fb5953663591f480f8e8faceb1ca1e30cb65b136e20803f1638227`, Web Skia `22c5f618343f59ef8b60bee6745bc2d237502a107fcdb60a43c312e4f0c57483`이다. Material3216242…/Cupertino 공급은 이전과 같다. workspace와 실제 별도 설치본의 전체 src/dist tree hash를 대조하고 source-map input guard를 통과했다. Core630modules·SDK112·native Skia59·Web Skia6이며 설치본은 workspace symlink가 아니다.

Core src/dist tree SHA-256은 `f8409242d8792ab16b910d36386ca95dccaad3a432343c0afaaf65126f3646ff`/`f18e6390873d93beb997d07c00c7a015ad57b0f6345f04170cf5819162b52de5`, SDK는 `94caba6cc3151d5cb7de486bd9d7e49ab4288adee20ede267a0934302915d7b8`/`14fbddc36182e52d8e2962fbfb2790a52f2826f813def102d4b3f2cb1e765250`이다. 이는 아래 공급 당시 identity이며 뒤의 §8.27 workspace와 혼동하지 않는다.

- **Windows bytecode 실제 제품:** diagnostic entry를 제거한 실제 Testbed를 새로 빌드했다. PID7628이 FIRST_FRAME, 실제 HWND/title, Responding=true,7초 뒤 exit0·forced=false·error=null·stderr 없음으로 종료했다. HBC `3ec3c847e9a8a3628f16efd0f81c196e58210372d9bfc2abc7fe91e8e15fb33f`, host EXE `00eeb894f0839e2f5982b6bd66c3357c0533f5ad2be8338c98dd525bb183842b`, VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`. source861modules/11owners/generated3제외, loaded79modules·RN runtime/Node-API JSI 없음, surface5다. native host source identity `fe4a092da4a8a283c697acb222ca6a3d0b9d40446a1189a59279e45092596f71`는 유지된다.
- **Static Hermes 실제 제품:** 같은 고정 설치본에서 컴파일한 DLL `d95a38d15e434da6df029a520b7fa78f17faa2598479461fdbae4477c22e722b`로 PID24580의 FIRST_FRAME·실제 HWND/title·Responding=true·7초 뒤 exit0/forced=false/error=null/stderr 없음이 통과했다. source861modules/11owners/generated3제외, loaded80modules·RN runtime/Node-API JSI 없음, surface5다. host/VM은 위 bytecode와 같다. app.hbc 없이37,176nativeFunctions의 image를 실행했으며 이 수는 compile 분류로서 실행 coverage가 아니다. 아래 §8.27 workspace 수정은 이 별도 설치본의 source/emit/native compile 입력을 바꾸지 않았다.
- **Web:** 현재 runner check/build와 실제 Chrome EditContext/CDP3개가 통과했다. JS `4f13e48310f77e6dc1bb6280d7d51af7fcfc5c8d6493ce26eac6874da3d33807`, map `0d0014543004122abb3de39c8ac45f9a228d31cb0c482cc13604958158d4292a`. CanvasKit JS `cc0c886876c07cd0a50c11b3adff344b7e069d1743ba47c2ce70b7861ee9e665`/WASM `2b9fe2ffe434b201055d122beff62f0e37865f72a86256053a0a4009c85c5f1c`는 동일하다. 테스트의 임시 browser/server/profile은 finally 정리되며 물리 IME 증거는 아니다.
- **Android:** 현재 runner check와 x86_64/Release/emulator-vulkan APK 빌드가 통과했다. APK66,018,832bytes, SHA-256 `85ac8dcc76f624629faaf19f344c74c6015aa1ca394fde68c3704fa2e32da4e0`. Java21은 child env에만 적용했다. 기존 Gradle/SDK XML 경고를 유지하며 실제 Android 실행·production signing은 notVerified다.

소스 SHA-256은 catalog `343f87ceb10423e46fa10f56cab059ab682978c2de967234675667ac83b38e95`, cache `1e1569cbac54aff435a8da81c8eb21114306cbaff3436205d5a5de3c5a5f51fb`, native text `c3096b9fd85d56ade4327ac905663a49a952326dfc97be079372c459ddd3d3ce`, Web library `59dc25a466f07d30921b99adba8746a796835bb70378069afa7a3529187aa337`, native assets `33a7d40f2a3d201c22d9b805618eb2770a61b0becbdd9451c750eefdceb0a118`다. 새 native 성능/전체 메모리/물리 수락을 이전 §8.20의25% 결과에서 자동 승계하지 않는다.

### 8.27 IN_PROGRESS — 실패한 GlobalKey 재배치의 retirement 복구

실제 State.activate/didUpdateWidget과 render attachment가 실패할 때 새 부모의 children에 없는 자식이 active인 채 GlobalKey registry에 남는 결함을 재현했다. 기존 소스는 두 focused 회귀에서 key.currentElement가 없어야 하는 조건에 실패했다. activation/attachment 실패는 기존 retirement owner의 inactive root로 되돌리고, retake가 반환한 자식은 update/slot callback 전에 local transaction의 cleanup 대상으로 기록한다. 성공 경로의 lifecycle 순서·새 record/queue·상태 pooling은 추가하지 않는다.

single/multiple child 경로 × State activate/update × undefined/null/0의12개와 render attachment의6개 조건이 통과했다. 실패 뒤 registry 해제·Element/State dispose1회·다음 정상 rebuild에서 새 State 생성과 key 재등록을 확인했다. 후속 scroll202·접근성98·전체 디자인266·편집98과10 workspace 타입 검사가 통과했다.

정리 중 render projection getter까지 실패하는 추가3가지 falsey 원본 오류에서도 동일한 orphan을 재현했다. deactivateChildren의 projection capture를 오류 수집 경계 안에 두고 이후 detach/deactivate/inactive admission을 계속 수행하도록 보완했다. 기존 성공 경로의 projection 읽기 횟수는 그대로이며 추가 성공-path 배열을 만들지 않는다. 원래 callback 오류와 cleanup 오류는 순서대로 AggregateError에 남는다. 이 후속 소스로 전체 framework reconciliation19개가 통과했으며 이전202개 묶음과 구분한다. 이 절은 §8.26의 고정 설치본 뒤 workspace/dist에서 구현했으며 새 공급/성능 수락으로 취급하지 않는다.

### 8.28 DIAGNOSTIC — 새 공급의 한 번의 bytecode PC sampling

§8.26의 별도 고정 설치본(Core2193…/SDKc227…)에서 sampling1회를 실행했다. PID12304가 정상 exit0/normalClose=true로 종료했고 loaded host/VM은 §8.26과 같으며 HBC `95cb02466492b6b697430e64effcc615a8344d23229ca078208a1492085083b1`다. 실행 소유 임시 fixture/profile/package는 finally 정리했다. programmatic 입력이며 물리/표시 수락은 아니다.

관측은 cold630·revisit651·fast548개이며 GC Young Gen은 각각27/32/46관측이다. cold/revisit의 finishLayer·freezePaintCommand와 native replay/recording, fast의 Set delete·JSON·ancestor 방문 등으로 분산됐다. 관측 횟수는 CPU milliseconds가 아니며 inclusive count를 self 시간으로 바꾸지 않는다. 계측에 영향을 받는 wall 결과를 §8.20의 정규 비교에 합치거나 새 p95 개선율로 쓰지 않았다. 현재 공개 recording/resource 계약에서 필요한 독립 hold와 값 캡처를 조사했으나 이 진단만으로 새 frame API/자원 수명 변경을 채택하지 않았다.

### 8.29 IN_PROGRESS — nominal class와 enum factory의 단일 선언 owner

source class를 다시 import하던7개 nominal helper 모듈을 선언 owner로 합쳤다. wheel renderer/widget, render tree parent data, ScrollableDetails, 2D scrollable/viewport, ChildVicinity의 실제 guard/cast/정수 문자열 body와 class identity를 유지하고 모든 제품 소비자를 이전한 뒤 옛7개 파일을 제거했다. generated/adopted 파일의 Dart 출처·pin·numeric annotation은 유지하고 product owner 주석을 반영했다. 역사적 converter recipe를 실행 입력으로 되살리지 않는다.

2D delegate의 nominal guard4개도 선언 owner로 옮겼으며 독립적인 Selectable/Widget factory는 기존 adapter가 소유한다. WidgetState가 full collections 모듈을 다시 import하던 empty set factory를 enum 선언 owner로 옮기고 기존 public widget-state subpath에서 export했다. Core·Material·Cupertino23개 소비자를 이전하고 내부 full-collections의 옛 empty export를 제거했다. const/map factory와 기존 domain identity는 그 모듈에 그대로 둔다. 바뀐 import 안내는 Core README 영문/한글에 반영했다.

Core·Cupertino·Material build와 fresh import/경계4개가 통과했다. 두 fresh ESM 순서에서8개 owner family의 실제 class prototype·Proxy prototype trap·거부 판정, live Symbol.hasInstance/receiver/falsey 오류, 2D scope token, public/generated empty set 함수 identity와 canonical enum 원소를 확인했다. 현재 graph945files/7,737runtime edges·위반0·디자인 SCC0, runtime SCC19→10이며 해당 owner들이 SCC로 돌아오지 않도록 회귀를 확장했다. 후속 scroll204·접근성98·전체 디자인266·편집98과10 workspace 타입 검사도 통과했다. 첫 디자인 회귀에서 발견한 테스트 import11곳을 함께 이전했으며 이전 실패를 기능 통과로 계산하지 않는다. Core623·Material257·Cupertino63modules의 현재 source-map input guard와 diff check가 통과했다. §8.27/8.29의 새 source/dist는 마지막 qualified native/Web/APK §8.26 공급과 계속 구분하며 같은 새 공급으로 통합 검증한다.

### 8.30 IN_PROGRESS — GlobalKey·nominal owner 변경의 현재 공급 통합

§8.27/8.29의 Core·Material·Cupertino를 함께 다시 pack/install했다. 현재 archive SHA-256은 Core `6b5b0fb3346ee01d67726fcfc9cbe7e94c6d562d0ade94eb6ecd2c0a52b8e625`, Material `f9adda18494831d3c26478e2329a7789b96799f71a098424e1ee67aca3f6f268`, Cupertino `adcfe40b8b79cb3ec12bb6aaf9c4ca462c450ca377940289d8cc1cce170843bf`다. SDK `c2276b3f03a711c5208501eaa3e96ac1fa1cb6676acb33919d17cba1a47c35df`·Skia-native `58275748c4fb5953663591f480f8e8faceb1ca1e30cb65b136e20803f1638227`·Skia-Web `22c5f618343f59ef8b60bee6745bc2d237502a107fcdb60a43c312e4f0c57483`는 §8.26 공급을 유지한다.

Windows/Web/Android의 독립 설치본을 현재 workspace 전체 src/dist와 대조하고 source-map input guard를 확인했다. symlink 없이 모든 대상에서 일치한다. Core623modules src `bfd0b76991e30875f041eb9108a1f3a4e45d1730acd80eabd7425e6b644f82be` / dist `cde3f6551c160b70170b415a0aff22a4f75e4d98ba692d8cc2885be8da9ced58`, Material257modules src `85d355225609f91549a095071c78f5cdab58199d58f69cc65738d6eb1bfd0d69` / dist `b871e5dc0fbe91a7ee58153711f5a17ea22bd17c44276f45744556f8ba20b3a2`, Cupertino63modules src `7428b167dca49dc5e36ed73ac8b00a96b7aa06a4dde021cd17c0356399940555` / dist `4049e132e0f6d0d52329b1b5fdc1338e6075896a3c33f44426b4fc8e8f068f3c`다. SDK112/native59/Web6의 전체 src/dist도 §8.26과 일치한다.

계측용 진입점을 제거한 실제 bytecode 제품을 새로 build/run했다. PID4080, HBC `71183ed2d5bddd6fdf587ca463de69c9b3adfeed2e1ca3ba054b12a4d0d8486e`, FIRST_FRAME·실제 HWND/title·Responding=true, surface6·exit0·forced=false·error=null·stderr 빈 값이다. source861modules/11owners/generated3excluded가 이 설치본과 일치하고 loaded79modules에 RN runtime/Node-API JSI가 없다. host EXE `00eeb894f0839e2f5982b6bd66c3357c0533f5ad2be8338c98dd525bb183842b`, VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`다. 같은 설치본으로 Static build454,363ms·실제 run도 통과했다. PID25892, DLL `11ee0db523fcce3f8e83b9dbe28775062d14283adfd9b3b2d5c3bf446ef52f16`, nativeFunctions37,177·app.hbc 없음, loaded80modules·같은 host/VM·noRN/noNodeAPIJSI다. FIRST_FRAME·실제 HWND/title·Responding=true, surface5·exit0·forced=false·error=null·stderr 빈 값이다. 후속 §8.31 source/dist는 이 설치본과 구분한다.

Web runner check/build와 실제 Chrome EditContext/CDP 입력3개가 통과했다. application.js `951c0ed920fc6f2fe6605ee5b4fed476e4220a1a2c74f4d6486c33a7432b5bc6` / map `46256fcf5d93b915bb149b9f0ce576559382d2ad438319c3398f035e5d9c66f7`; CanvasKit JS/wasm은 §8.26과 일치한다. Android runner check와 Release/x86_64/emulator-vulkan build도 통과했다. APK66,019,072bytes `f514a08bf4e50329b29c4363237e94edcf7379ed346a03248304d2bfc8236838`; Java21은 child 환경에만 설정했다. 기존 Gradle deprecated/SDK XML 경고는 남고 Android runtime·production signing은 notVerified다.

이 시작/공급 검사는 현재 cohort의 정규 성능 비교·물리 입력·실제 표시·전체 메모리 수락을 대신하지 않는다. §8.20의 선택 성능과 §8.21의 자원 회수 결과는 각 당시 공급의 증거로 유지한다. runtime graph는 현재10SCC/디자인0/위반0이며 전체 R0~R7·기본 host 전환은 계속 PARTIAL이다.

### 8.31 IN_PROGRESS — W18-08 종료 transaction의 재진입·실패 보존

실제 AppSession/View API의 종료 callback 재진입을 대조했다. 옛 구현은 서로 다른 종료 Promise를 만들고 renderer를2회 dispose했다. View와 AppSession이 사용자·clock·observer·renderer callback보다 먼저 단일 Promise를 게시하도록 바꿨다. admission 차단과 기존 동기 정리 순서는 유지하며 실패한 종료를 재실행하지 않는다. callback 정리와 renderer drain이 함께 실패하면 양쪽 오류를, registry retirement와 View drain이 함께 실패하면 양쪽 오류를 보존하고 의존 service는 반환하지 않는다. falsey throw도 수집한다.

공통 native renderer에서도 GPU lease의 반환 callback이 close에 재진입하면 옛 구현이 event identity를 먼저 지워 `unknown/duplicate retirement`로 실패하는 것을 재현했다. GraphiteRenderer는 drain 전에 같은 종료 Promise를 게시한다. Web renderer는 picture 정리 전 admission을 닫고 같은 Promise를 게시한다. 옛 Web dispose의 동기 정리 오류와 이후의 성공 Promise를 함께 제거하고, 실패한 Promise·미확정 context 의존을 유지한다. 별도 drain 재시도나 resource callback 재실행을 추가하지 않는다. Core 영문/한글 및 native/Web 기존 README에 계약을 반영했다.

Core·Skia-native·Skia-Web build가 통과했다. task/controller/observer/renderer의 실제 close 재진입, falsey callback/drain·registry 복합 실패, 보류 drain의 service 보유, Web admission·context 보유7개와 실제 native lease 반환 재진입1개가 통과했다. 새 API 회귀의 각 문제는 옛 구현에서 실패를 먼저 확인했다. 후속 scroll212·native replay33·전체 디자인266·10 workspace 타입 검사도 통과했다. 공급 전 source SHA-256은 Core runtime `e637da14c7d1705ba0c31249536a0de357a5b0b3b5cf10e5bd2ff2077e9dd619`, native renderer `ed4017b8344a9347fc7a7e97047e48f88a6f234662f64782ffd1b92e7ce0b684`, Web library `8d7dd3c400d9acf6b677187464237da3b5448fe63c5f50078cc84faab4d02182`다. §8.30의 실제 제품과 별도로 새 공급을 확인하며 W18-08 전체 조립·R5 최종 수락은 PARTIAL이다.

### 8.32 IN_PROGRESS — 종료 수정의 현재 제품 공급·실행

Core/archive `2be99a21848f48105e275d22edba45c70a4b3d1919dcfa6d256e09722eb2baf6`, Skia-native `3ff485a50d58458d60562d4a9c746997fd2fd819bb0e996917c3fb415bd74ce8`, Skia-Web `fdc9161c5cd51b4a886bfc94bfe241559ece0e161582fe1d50e46c398d29dd49`로 세 target을 공급했다. SDK/Material/Cupertino/RN은 §8.30 archive를 유지한다. 전체 workspace src/dist와 Windows/Web/Android 설치본의 독립 대조·source-map guard가 다시 통과했다. Core623modules src `4c276ff69831b4c20555f49eb87e842ef8c3f93fcdc7a6e840a65d698ded2a56` / dist `bfe32d649a2f6dd9e1ec2552050b314226ed9a88d6aa8785b589481269d72706`; native59 src `4c9612da3767b9e7dd91862b3fdb031460e641c12a8cc2cc2e3245bde9db582f` / dist `4a1e75a12f6e483323a26084a26548f5d5579c5d9f867480dde5c74d5d08c468`; Web6 src `fe3889eac8d416182928467a5e7c728b0e5e7fb2deb67e1ecc7d2e0e8b4bed26` / dist `f9b71ebf682cda0ca6a280ce3de9b2ab7512dcb083d9981586557789d8632374`다. 나머지 대조 owner는 §8.30과 일치한다.

actual product bytecode build94,376ms, PID7364/HBC `3e2ee59488261e376708a1eef467cb1a9ebc4ab784c55a166f648d4fdeff56a1`; Static build447,139ms, PID7224/DLL `d8874468a68f1e17bad23e0c2e6bf2a3448ec1aa480d792657211a534c53f466`·nativeFunctions37,181·app.hbc 없음이다. 각각 FIRST_FRAME·실제 HWND/title·Responding=true, surface6·exit0·forced=false·error=null·stderr 빈 값이 확인됐다. 두 제품의 source861modules/11owners/generated3excluded는 현재 설치본과 일치하며 loaded79/80modules에 RN runtime/Node-API JSI가 없다. 이번 native 재컴파일 EXE `efa8b631c16d3182fa2b1249c717a9cf9edf036d4ce8217e92d51bb4bee4789e`, VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`, host source identity `fe4a092da4a8a283c697acb222ca6a3d0b9d40446a1189a59279e45092596f71`다. 현재 HEAD는 `f59c049a28862d35348ddff417d7405894aa1f66`이며 dirty 구현을 별도로 유지한다.

Web runner check/build·Chrome 입력3개가 통과했다. application.js `dd7feb361d93dbcff679805b792813e23686ff7a1dc5b0c4e25a5dfc0d58d0dc` / map `f809bae18fc7f78326fcdbd66427ff765bcf6ab656f01bfb45f085b9266e05eb`; CanvasKit runtime은 §8.26과 일치한다. Android check·Release/x86_64/emulator-vulkan build75,529ms도 통과했다. APK66,019,708bytes `8dc337334e63ceaabf34d71ccf701975623dd100df3a89b225963eae6787e33e`다. Java21은 child 환경으로 한정하며 기존 Gradle/SDK XML 경고·Android runtime/production signing notVerified를 유지한다. 공통 Engine 조립5개도 정상·시작 실패·실패 drain 보유·명시적 복구를 다시 확인했다. 정규 CPU/메모리·OS 물리 입력/reader/표시 수락을 새 결과로 승격하지 않는다.

### 8.33 PASS-scoped — W18-09 실제 Web catalog 소비

`npm run test:web-catalog`는 현재 공급의 실제 Testbed를 Chrome에서 열고 원본 catalog AST로 얻은 Material29·Cupertino20개 선언을13개 category 경로에서 탐색한다. 인접 static text가 group/list에 합쳐지는 실제 semantics 계약과 tooltip의 aria-description, IconButton의 aria-selected를 소비한다. 일부 제목이 개별 text 노드가 아니었던 초기 검사 오류를 selector 단계에서 바로잡았으며 제품 의미를 바꾸지 않았다. Material14·Cupertino10개의 ready/basic 선언과 나머지 planned placeholder를 구분한다. 모두 semantics tree에서 관측됐으며 실제 wheel은 Material containment1/navigation2/selection2회, 나머지 category는0회였다.

실제 canvas pointer로 Elevated·Favorite·Add message·Cupertino Favorite·목록 Notifications callback, named route 결과 반환과 디자인 교체 뒤 Material Favorite 선택을 확인했다. pageerror/console error0, 전체 실행10,984ms로 통과했다. 임시 Playwright 설치/profile·browser/context·HTTP server는 finally 정리했고 잔여 catalog 임시 디렉터리0을 확인했다. 기존 영문/한글 sample README에 실행법과 범위를 반영했다. 이는 모든 control 동작·native catalog·물리 IME/reader·픽셀 출력/표시 시간을 수락하는 검사가 아니다.

### 8.34 IN_PROGRESS — W18-07/08 native endpoint retirement·action 요청 owner

acquired lifetime을 가진 NativeInteraction의 observer가 dispose 중0을 던지면 영구 closed 상태로 전환하지 못하고 새 편집기 등록을 다시 허용하는 것을 재현했다. service lifetime의 실제 retirement와 publication을 분리했다. 영구 dispose는 먼저 입장을 닫고 편집기·port·semantics·focus 의존을 반환한 뒤 한 번 게시하며, 구독 오류 뒤에도 나머지 등록 observer를 통지하고 모든 구독을 비운다. acquired lifetime의 별도 빈 갱신과 영구 종료의 중복 publication을 없앴다. 일반 service lease 반환은 다음 lifetime과 새 editor generation을 계속 허용한다. ordinary state publication의 기존 오류/retry 의미를 바꾸지 않는다.

동일 native action 요청의 deferred perform을2회 전달하면 실제 activate도2회 실행되던 경로를 재현했다. 첫 전달을 validation/사용자 callback보다 먼저 소비한다. 원래 node lifetime이 살아 있는 동안 지연 전달은 최신 callback을 찾으며, 중복·재진입·falsey callback 오류 뒤 재호출과 첫 disabled delivery 뒤 재활성화로 요청을 다시 실행하지 않는다. 교체·폐기된 node도 계속 거부한다. 일반 action의 지연 가능성을 text/range action의 동기 경계로 축소하지 않았다.

새 lifetime/action5개는 옛 구현의 실패를 먼저 확인하고 통과했다. 영구 종료의 acquired/direct 경로·undefined/null/0·모든 observer의 오류 순서, lease 반환 뒤 재사용·generation·늦은 구독/편집기 거부를 포함한다. 기존 편집/native Engine/직접 interaction/semantics/Android lifetime45개와 Windows 입력 service/view·native semantics tree·editable semantics37개, SDK build/check도 통과했다. NativeInteraction source SHA-256 `a032c03fd76fd766112e3cf101fb57b1cb075c2d9a8c746655c38ac9abc4d3ad`; 기존 SDK 영문/한글 README와 test:native-editing에 계약·회귀를 연결했다. 이 SDK source/dist는 마지막 qualified 제품 §8.32와 구분하며 새 SDK만 세 target에 재공급하고 확인한다. 전체 geometry·SDK composition·R1/R5 최종 수락은 PARTIAL이다.

### 8.35 PASS-scoped — native endpoint 수정의 현재 제품 공급

SDK archive `fcea39b4eae484920b879a3fe9c3c3a6bbda9a9e8308bc23d835abac1c4117e3`를 Windows/Web/Android에 독립 설치했다. Core/Material/Cupertino/Skia-native/Web은 §8.32와 같다. 전체 src/dist·source-map input guard가 일치하며 SDK112modules의 src `8787d5d57f49de0cd978257913171409021ae9dc2eb85f7247dd2f6059839ad7` / dist `c3a7e64ae722d74c6e8cdf24e663e01f93e3ff9059992045ebca9a4041435a85`다.

계측 진입점 없는 실제 bytecode build53,544ms/PID856/HBC `1ffe195093405e18b7e5e8f58a67f8cbc770449d7ee700566199528d24db337e`, Static build473,220ms/PID27704/DLL `d6b27e6a383889f214fe52c58f6d166fd1f21347c34074860e68c5a6db0528b7`를 확인했다. 두 모드 FIRST_FRAME·실제 HWND/title·Responding=true, 각각 surface6/5, exit0·forced=false·error=null·stderr 빈 값이다. 현재 source861modules/11owners/generated3excluded가 설치본과 일치하고 loaded79/80modules에 RN runtime/Node-API JSI가 없다. Static nativeFunctions37,185는 compile 분류이며 app.hbc는 없다. 공통 host EXE `6dee2263ecbf89737b3a5247c2dae69470af49bf9b6bd8e42addb34c3a43b810`, VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`, host source identity는 §8.32와 같다. qualification은 계속 experimental이다.

Web runner check/build가 통과했고 JS/map/CanvasKit JS·wasm이 §8.32/8.33의 검증 바이트와 전부 같아 Chrome 입력3개·catalog 결과를 그 동일 산출물의 증거로 유지했다. Android check·Release/x86_64/emulator-vulkan build63,118ms, APK66,020,592bytes `4332c2d1b394372b440d7dc7906bbde0ef044a431e88708fb01325525aadfec6`도 통과했다. 기존 Gradle/SDK XML 경고와 device runtime·production signing notVerified를 유지한다. 정규 성능·전체 메모리·물리 입력/표시 수락을 새로 얻은 결과는 아니다.

### 8.36 IN_PROGRESS — RNW 현재 시작 실패와 원본 위치 진단

현재 RNW supplier `bd5059de779253ac69b61548d43ea3c07d94a987146536034287f944703380c8` 검증과 workspace/설치 Core 전체3,116files aggregate `fb8851aa7621dcd9d6d77728cd93015c0c3781e2b571f28d6e6be3603933ec99` 대조가 통과했다. Hermes optimized/Release의 단일 queued/bounded 진단은243,422ms 뒤 Core 첫 build의 `TypeError: undefined is not a function`으로 실패했다. HBC `9e2b0090a2c571eaffb7fc392b9944d0314c9d2915a07302a282ba89506c7679`, host `09aea376f603ef6f00764ac9caa9a318eefe8343ae47a85cf26185cc4503bc22`, RNW VM `c4a1d80bcecacde0fd64b2c0927138095ed0e98e37334a53f42949b050186d68`다. surface/phase0·profile exit8이며 native fault PC는 없었다. 과거 AV를 해결했다고 처리하지 않는다.

기존 실행 소유 임시 출력의 diagnostic Metro map으로 Core failure stack을 원본 위치에 연결하고 종료 전에만 출력하도록 진단을 보강했다. 정규 timing에는 map 생성을 추가하지 않는다. source-mapped 단일 진단190,796ms에서도 같은 오류가 나왔고 fixture `windows-animation.tsx:155`의 layout 계측 wrapper→126행의 누락 callback 호출로 정확히 연결됐다. Core의 선택적인 perform 인자를 진단이 필수라고 가정한 baseline 관측 코드 결함이다.

기본 body가 생략되면 같은 render owner의 performLayoutInScope를 실행하고 명시적인 callback은 그대로 호출하도록 fixture를 이전했다. 실제 fixture hook을 Core RenderBox에 연결한 검사는 옛 코드에서 실패한 뒤 debug/Release×undefined/null/0 오류, clean fast return·명시적 body·실패 후 retry를 통과했다. 실제 map/one-based stack column·잘못된/다른 bundle frame 배제·실패 보존을 포함한 PC/scroll/diagnostic12개가 통과했다.

수정 fixture의 단일 진단211,695ms는 초기 build를 지나 ListView/Material/Cupertino의 bounded10phases를 실행했으나 `Observed VM PCs have no resolved symbols`로 profiler exit8이었다. source `2275bf08169f3b30e5877c0ca0a7880ad94807b280cdfc53dd2b9d09dbf2d107`, HBC `c332fd88aa8002b52573ade8191841cf08b9d1353f0c580049bd3a47aa9b302c`, host `5e57e8862802f4d97bd511611814682db87a78468dcde5b8bdfea2e668cd37ee`, VM은 위 stock 공급과 같다. native fatal/JS 오류는 없었지만 전체 진단 PASS는 아니다. stock NuGet에 해당 PDB가 없어 PC attribution을 수락하지 못했으며 symbol 기준은 유지한다. 별도 진단에서만 `NELYX_SCROLL_NATIVE_PC=0`으로 외부 PC 수집을 명시적으로 끌 수 있게 하고 출력의 nativePc/완료·정상 close marker를 분리했다. 두 언어 sample README에 계약을 반영했으며 현재 이 별도 범위를 실행 중이다. 제품 Core/SDK 공급을 바꾸거나 OS 입력·정규 성능·과거 AV 해결로 계산하지 않는다.

**별도 no-PC 진단 PASS-scoped:** 205,077ms, 위와 같은 source와 현재 Core/SDK 설치본으로 RNW optimized/Release queued/bounded10phases를 완료했다. HBC `9774f021f95c67f1e6ee2fb1f11c94f97f5c5a09a8878f690fc894e70ae9a068`, host `9c22d41c6174518064cbd0d9463cddc9022a553ee04a19af01bfe52fd159977a`, 같은 stock VM, viewport487×464.5/scale2다. nativePc=false, scrollCompleted=true, normalClose=true, exit0·fault/JS 오류 없음·입력48+9×240개 전달 보존을 확인했다. 실제 views0/consumers0/GPU drain/input retirement marker가 일치했다. 정상 종료 시 private96,518,144bytes는 한 번의 관측이며 전체 메모리 수락이 아니다. 과거 RNW AV·모든 catalog/OS 입력/성능과 VM PC attribution은 미해결/미수락으로 유지한다. 실행 소유 임시 host/entry/config·runner 설정은 finally에서 정리·복원했다. §8.37의 후속 Core source/dist와 구분한다.

### 8.37 IN_PROGRESS — tree widget의 선언 owner·실제 State 경계

TreeSliver의 value/type capture·animation map·행 identity·ParentData·extent helper를 실제 클래스 선언 owner로 합쳤다. 옛 tree-widget-source-types 한 파일을 제거하고 treeNodeType/treeWidgetType의 내부 소비자2곳을 선언 owner로 이전했다. tree-generic-witnesses는 독립 abstract-interface token과 공통 framework witness만 보유한다. 기존 helper body·등록 정책·class/row identity·원본 provenance/numeric annotation을 유지하며 새 node field·owner registry·호환 wrapper를 추가하지 않았다. 공개 TreeSliver/TreeView import는 유지하고 저수준 내부 import 변경은 Core 두 언어 README에 반영했다.

Core build와5개 module의 fresh ESM 양방향 초기화·Dart witness/type 거부·동일 content의 독립 node identity·source value 정책, 실제 TreeView의 확장/접기·형제 reorder·사용자 State와 RTL dependency 유지·stale row toggle·reveal·최종 retirement가 통과했다. 첫 primitive fixture의 누락 platform 설정은 테스트에서 수정했으며 제품 소스 의미를 바꾸지 않았다. 전체 scroll216개·10 workspace 타입 검사와 graph944files/7,717edges·위반0·디자인 SCC0이 통과했다. runtime SCC10→9이며 tree owner/abstract witness가 cycle로 재진입하지 않도록 경계 회귀를 확장했다. 현재 Core622modules를 새로 공급 중이며 마지막 qualified 제품은 §8.35/8.36 cohort다. 전체 W18-03/09·R0/R1 최종 수락으로 승격하지 않는다.

### 8.38 PASS-scoped — tree owner 변경의 공급·실제 제품

Core archive `3a60d16f9d98a2c6925068c2ef359aef11b236ceb97538f6e36f3c0efac83af2`를 세 target에 공급했다. Core622modules src `4e5626ad2389ac96999e40d6046803e92e124ed63a11f6cd1979a6926bc8bbee` / dist2,488files `4fc6fcbde4489ff780013414f10e769287e9f8206ba8044dbb3ad94696124aec`가 모든 독립 설치본·source-map input guard와 일치한다. SDK/Material/Cupertino/Skia-native/Web/RN은 §8.35 archive와 같다. 이 tree 확장 경로는 현재 Testbed native의502개 Core runtime module에는 포함되지 않는다. 전체 Core의 공급·source 회귀와 실제 앱이 실행하는 closure의 증거를 구분한다.

bytecode build40,411ms/PID16860, HBC/host/VM은 §8.35와 같은 바이트다. Static build66,527ms/PID3068, DLL `a93855d795b077f08465b5ee76ec0a98ecb0d434d172df9f97f868d2a9e1a3e7`, nativeFunctions37,185·app.hbc 없음이다. 둘 다 실제 HWND/title·Responding=true·FIRST_FRAME·surface5·exit0·forced=false·error=null·stderr 빈 값, 현재 source861modules/11owners/generated3excluded와 loaded79/80modules/noRN/noNodeAPIJSI를 확인했다. Web check/build의 JS/map/CanvasKit와 Android check·Release/x86_64 build61,808ms의 APK66,020,592bytes는 §8.35와 동일해 같은 산출물의 기존 Web 입력/catalog 증거를 유지한다. Android device runtime/signing·정규 CPU/전체 메모리·물리 표시 수락은 별도다.

### 8.39 PASS-scoped — 현재 두 Hermes 제품의 외부 native UIA

사용자가 즉시 입력 독점 가능하다고 응답한 뒤 2026-10-26 12:25~12:27 KST에 현재 실제 제품으로 bytecode/Static의 focus와 range를 각각 한 번 실행했다. 테스트 도구는 현재 소스로 별도 build한 EXE `ae37a954d2e2410ef71afb9518d8bb5080f72a75e39209c7b8ee60eb5e6d18a2`다. UIA 편집기 focus PID9732/14792에서 같은 owner·같은 control ID·hasKeyboardFocus·실제 category navigation이 모두 true였다. 이전 foreground 실패를 새 결과로 덮지 않으며 현재 공급에서 성공한 범위로 구분한다.

Range PID7280/11684는 실제 selection category에서 Material absolute/discrete·양 thumb ordering·invalid value 거부·disabled/read-only와 Cupertino slider를 각각6 requests로 통과했다. 현재 commit을 지정한 native semantics action이 수락됐으며, bytecode 입력12/12/12·wheel Y720/720, Static14/14/14·wheel Y864/864로 수신/전달/수락과 이동량이 보존됐다. 네 실행의 actual source/loaded identity는 §8.38과 일치하고 각각 surface16/15/53/59·exit0·forced=false·error=null·clientError=null이었다. 자동 생성한 모든 창은 닫혔고 사용자에게 입력 재개 가능함을 알렸다. 이 결과는 자동 UIA 기능·정상 종료의 증거이며 물리 한글 IME·실제 reader·precision trackpad·content-to-display 성능 수락은 계속 notVerified/unobserved다.

### 8.40 PASS-scoped — RichText·inline WidgetSpan의 단일 선언 owner·현재 공급

RichText와 WidgetSpan/ParentData/배율 renderer의4개 클래스를 같은 선언 owner로 묶었다. public widget-span은 같은 WidgetSpan을 named reexport하며 RichText는 더 이상 이 public facade를 역으로 import하지 않는다. WidgetSpan 단독 import에서도 실제 RichText ancestor 클래스를 즉시 반환한다. 추가 constructor registry·미초기화 witness·per-node field·호환 class wrapper를 만들지 않았으며 원본 클래스/method body는 정규화한 HEAD 본문과 정확히 일치한다. public import/생성자·State·진단·배율·자원 계약을 Core 두 언어 README에 반영했다.

독립 두 import 순서의 실제 class identity/ancestor·미마운트 child 추출과 실제 CanvasKit RichText의 inline child State 유지·RTL·비선형 scaler의2→1.5 geometry·문단/child retirement가 통과했다. source graph944files/7,714edges·위반0·디자인 SCC0이며 runtime SCC9→8이다. 두 파일의 cycle 재발도 경계 회귀가 거부한다. 전체 scroll218개, 실제 icon/RichText consumer7개와10 workspace 타입 검사도 통과했다. RichText source `a8b7c7587e08dce3d658cf33a17c42f0e700fbc115608b371ba7146c23cfa770`; 이동한 class body는 기존 HEAD와 정확히 일치한다.

현재 Core archive `cadc9adeefa865caab052b541c87ed8ecee4b2f5100c02b2da33190de795be24`,622modules src `cc0bc65aec252432c32af4b51847defaa7f83412171c7ce6dd50da75953d649c` / dist2,488files `b8fdc03f1998af7d546c70610df0b772cb2078c7493d02576c61998f054a8ac6`다. Windows/Web/Android의 독립 설치본 전체 src/dist·source-map input guard가 일치하며 다른 package archive는 §8.38과 같다. bytecode build276,607ms/PID26044/HBC `4dee03abeff3e2c884a7bc5edb4a152f13b4915aa225da3f639f1b572bb25fb2`, Static build441,138ms/PID12064/DLL `4b8934e0e1d1fdc4a7ca025d0c0657132b63c16181f5d016d6e3f92a2b2e8478`을 확인했다. 두 실제 제품의 FIRST_FRAME·HWND/title·Responding=true·surface5·exit0/forced=false/error=null/stderr 없음, source860modules/11owners/generated3excluded·loaded79/80modules/noRN/noNodeAPIJSI가 일치한다. host/VM은 §8.38과 같고 Static은 nativeFunctions37,181·app.hbc 없음이다. bytecode의 긴 build도 정상 종료까지 기다렸으며 CLI 성공을 강제 종료로 만들지 않았다.

바뀐 Web JS `a1cfe4665cf07fcfd28f5da026b4344d5b50177db103df458850db74a159aa1a` / map `f3a33d5fc136fb061163fcb2ab540b959647566ae59d9b65a2921d205c6f3b4e`로 check/build와 Chrome 입력3개81,549ms·실제 catalog1개11,191ms를 다시 통과했다. CanvasKit은 §8.38과 같다. Android check·Release/x86_64 build106,547ms, APK66,019,548bytes `9db5b1e4243c5c40cd448a878d7121a37d222a392f1f1440f7987863493938e0`도 통과했다. Java21 child 환경·기존 경고·device runtime/production signing notVerified를 유지한다.

현재 SDK/VM·준비한 native test binary·제품 ICU hash를 대조한 뒤 실제 native 계약10groups도2,855ms/exit0/stderr 없음으로 통과했다. 실제 Hermes의 installed VM environment·microtask/late callback/rejection/drain, VM thread/cancel/reentry,64개 초과 pointer와 key/frame/close 순서, native 입력/trace 한계,23opcode의 raster 픽셀·잘못된 packet의 atomic rejection·save balance, 실제 Vulkan recording의 forced GC/snap/drain과 UIA snapshot/revision/retirement를 포함한다. OS 입력을 주입하지 않은 C++ 계약 검증이며 앱 전체 표시·GPU/process/driver 메모리·성능 수락이 아니다.

현재 소스/공급은 이 절이며 이 공급의 외부 UIA 검증은 §8.41이다. 다음은 남은8개 runtime SCC와 stage별 scene/text/geometry·SDK composition의 실제 owner/소비자 이전을 대조하고 R0~R7을 닫는 작업이다. 새 출력/회귀를 이전 성능·물리 수락으로 승격하지 않으며 기본 RNW/Hermes optimized를 유지한다.

### 8.41 PASS-scoped — 최신 RichText 공급의 외부 native UIA

사용자의 새 즉시 입력 독점 가능 응답을 받은 뒤 2026-10-26 13:03~13:05 KST에 §8.40의 실제 bytecode/Static 제품으로 focus·range를 각각 한 번, 총4회/72,174ms 실행했다. 현재 source860modules/11owners와 실제 loaded79/80modules/noRN/noNodeAPIJSI가 일치했다. host/VM·bytecode HBC·Static DLL은 §8.40과 같은 바이트다. 두 focus 실행은 sameOwner/sameId/hasKeyboardFocus/productNavigation=true였다. 두 range 실행은 Material absolute/discrete·thumb ordering·invalid value 거부·disabled/read-only와 Cupertino slider의6 requests를 통과했다. bytecode 입력12/12/12·wheelY720/720, Static14/14/14·wheelY864/864로 보존됐고, 네 실행 모두 exit0/forced=false/error=null/clientError=null이었다. surface는 focus14/15·range51/66이다. 모든 창은 정상 종료했고 사용자에게 입력 재개 가능함을 알렸다. 물리 한글 IME·실제 reader·precision trackpad·표시 성능은 계속 notVerified/unobserved이며 추가 OS 입력은 실행하지 않는다.

### 8.42 IN_PROGRESS — native Picture·raster recording의 단일 packet 경계

frame은 직접 packet을 사용하지만 retained Picture compile/context restoration과 Picture.toImage는 다시 명령별 Canvas replay로 들어가는 실제 경로를 확인했다. 두 compile 경계를 기존 scene encoder/display-list1로 통합하고 공통 NativeEngine이 같은 nativeDisplayLists capability와 resource lookup을 세 소비자에 공급하도록 바꿨다. canonical JsiSkPictureRecorder에 open-recording packet binding을 추가했다. 기존23opcode·wire11·GPU admission/lease/cache budget은 바꾸지 않는다. CanvasKit recorder는 이 native capability를 제공하지 않으며, native Engine은 오래된 supplier를 조용히 fallback하지 않고 거부한다. 해당 계약은 native package README에 반영했다.

기존 구현에서 새3개 회귀가 Canvas replay/잘못된 fallback으로 실패하는 것을 먼저 확인했다. 변경 후 picture compile·generation restoration·toImage 출력/별도 cache owner, 실제 Engine의 producer 재사용/마지막 admitted lease retirement를 통과했다. native replay36·Engine6·runner supply6 및10 workspace 타입 검사도 통과했다. 공급 전에 TS뿐 아니라 canonical C++/recipe/공급 script의 파생본을 검사하도록 prepare-sample과 RNW native builder를 보완했다. native/RN의 실제 파생본과 Windows/Android 설치본 각각161files 대조, 오래된 binding·제거/누락된 compiled input 거부2개를 통과했다. Core capture/전체 retained scene·text ABI·최종 성능/물리 수락은 계속 PARTIAL이다.

C++ 검증 바이너리 `beb011d281756317f9ff1f3c8f074e2b23e2fc5149503051592ed6afa4ad43a8`로 실제 native 계약10groups/2,786ms/exit0/stderr 없음을 확인했다.23opcode를 기존 명령별 PictureRecorder와 새 packet PictureRecorder에 같은 입력으로 넣어 픽셀이 전부 일치했고, malformed packet의 부분 mutation·기록 전/finish/dispose 후 입장을 거부했다. 첫 직접 raster 대 Picture 비교의 saveLayer/중첩 Picture 가장자리 차이는 기존 PictureRecorder에서도 나타났으며, 기존 기록 방식과의 비교를 유지해 구분했다. 기존 직접 raster packet 픽셀 비교·Hermes VM/입력·Vulkan forced-GC recording/drain·UIA 계약도 그대로 통과했다.

새 RNW supplier build56,725ms와 설치 CLI prepare16,260ms가 통과했다. input SHA-256 `1d0dcbc1ba296e975c885bdc697b6e6c8580be3ba81e67d37a54e379af98e40f`,1,795files/226,067,991bytes다. 자동 승인 검토가 교체 전 `sample/nelyx-testbed-app-2/.nelyx/windows-native/bd5059de779253ac69b61548d43ea3c07d94a987146536034287f944703380c8` 삭제를 **blocked by policy**로 거부해 해당 폴더는 유지한다. §8.6의 두 cleanup 거부 경로도 재시도하지 않는다. 현재 제품 실행/Static 빌드·RNW 진단은 진행 중이다.

### 8.43 PASS-scoped — 단일 native recording 경계의 현재 제품 공급

현재 archive는 Core §8.40 그대로, SDK `d4b2b859fbc06208071f59b27565c6caeabe9554019c7a2671bbf28e87d060d8`, Skia-native `be110344001c0ccdc021d407bf4f1111b2d52eee5b8ec030ebb746a8c1e396d3`, RN `78570d05d9638934f89c1688500640746dee27638a4a917361a5fe84cde892bc`다. Windows/Web/Android의 전체 독립 src/dist·source-map input guard가 일치한다. SDK112src `39c13973058257ec6ab082c8f8ea6bca0b5eb6f24342f1b4d58749438de0c8e8` /448dist `3e6124578d9fbeb26c5042cb7fc4457b629ee4ebbcacf889a747af11069eef0b`, native59src `ee79fb2f8d4bb67fe34eeda24e9d7b1cae9781994e5bf05b7fd7d49f1305bfc3` /236dist `d4f0668b8d380ec8db271957a8582b486a548fc84b633b293ffe8c61123f3caa`다. 그 외 owner는 §8.40과 같다. canonical/파생/설치 PictureRecorder header SHA-256 `1285a6e005c3df50fb0bd5a8e6d7c9ea9c50fa8a2ea31fdc1493b6e99d5c9c7e`가 일치한다.

bytecode build53,374ms/PID22364/HBC `638c51c41f3a6700e338124c02eb00733a5296f5ab45acb90969b49827bc0c25`, Static build494,801ms/PID9968/DLL `c7b3058ddfdb2a5060661e9c43d2bcfb38bba84ca990295c37cbc2aa166ad90e`를 확인했다. 두 실제 제품의 FIRST_FRAME·HWND/title·Responding=true·surface6·exit0/forced=false/error=null/stderr 없음, source860modules/11owners/generated3excluded·loaded79/80modules/noRN/noNodeAPIJSI가 일치한다. 공통 host EXE `179275b234c34be47380ac320d2c72f4510d261f16beb7128d6cefbad6524ef4`, VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`, host source `2af214c55d3e4483a153a5819cac45ed77f71ddbb3f734b44e24f293bd97ee09`다. Static nativeFunctions37,180은 compile 분류이며 app.hbc는 없다. 설치 CLI doctor와 두 모드 pack/ZIP의 전체 file·size·hash·manifest 대조가 통과했다. 임시 ZIP 두 개는 finally 정리했다. template/asset/package·boundary·native source guard11개도 통과했고 runtime graph는944files/7,714edges/8SCC/design0/errors0이다.

Web check/build의 JS/map/CanvasKit은 §8.40과 같은 바이트로 그 산출물의 Chrome 입력3개·catalog 증거를 유지한다. Android check·Release/x86_64/emulator-vulkan native 재컴파일218,841ms, APK66,036,280bytes `8800eedc700950e6ece592f0fc86f718e0e68f24e1f9ab10f9e47f0ed4e9d7cf`가 통과했다. Java21 child 환경·기존 Gradle/SDK XML 경고·기기 runtime/production signing notVerified는 유지한다.

§8.42의 새 RNW supplier에서 Hermes optimized/Release queued/bounded/no-PC 단일 진단233,205ms도 통과했다. source `c73e82dc48fac32fb881fd2c7398b41447e2be2d99f1e8f47defceca83d904fa`, HBC `1a2cd645ecd4eb992d6142a496a7de0cc198889b6d951910420a43a4cd56644d`, host `af0779403713cb31e3134de095af0225c3f0c06405a5f34a7fd3ccbd147edc8b`, stock VM은 §8.36과 같다.10phases/입력48+9×240개 전달·처리·이동량과 scrollCompleted/normalClose/exit0, JS/native 오류 없음을 확인했다. Static 빌드와 겹쳐 실행한 기능/종료 진단이며 정규 timing·VM PC symbol·과거 AV 해결의 증거가 아니다. 실행 소유 fixture/host/config는 finally 정리됐다. 마지막 외부 UIA는 §8.41 공급이며, 새 제품 전체 성능·메모리·물리 표시 수락으로 승격하지 않는다. 다음은 Core recording에서 frame으로 이미 보유한 command/resource lease를 다시 capture하는 경계다.

### 8.44 PASS-scoped — Core recording buffer·resource binding의 단일 소유 경계

FrameworkRoot는 완성된 buffer·기존 command/resource hold를 가진 FrameRecording을 반환하고 View는 같은 build token으로 한 번 소비한다. 최종 frame에서 resource 명령/ID/hold를 다시 capture하지 않는다. 내부 borrowed Picture는 sealed ID/style 값을 공유하며 별도 command hold를 가진다. public createScene/controller 배열과 public Canvas/명령 복사는 기존 capture/독립 ID·hold 경계를 유지한다. Root 직접 소비 API는 captureSceneFrame/releaseSceneFrameSource로 이전했으며 Core 영문/한글 README와 실제 CPU 소비자2곳을 갱신했다. 단일 image의 기존 Canvas→frame은 retainer2회, 소유 recording 전달은1회라는 bounded 관측을 확인했다. 이는 CPU/전체 할당량·메모리 수락이 아니다.

캡처한 ResourceId는 binding도 immutable로 고정한다. Image는 rebind 대신 처음부터 검증된 registry owner로 한 번 capture하고, registry의 retainer도 원래 mutable 입력 대신 캡처한 identity를 사용한다. 원래 입력의 후속 변경으로 과거 recording이 다른 ID를 붙잡는 경로와 Image indexing 오류 뒤 hold 미반환을 검증했다. 새 sealing 때문에 처음 디자인 회귀에서 Image 생성이 실패한 경로는 Image owner를 같은 단계에서 이전해 해결했다. 마지막 부분 변경 전 scroll230·paint113·디자인266·native replay36이 통과했다. 그 뒤 post-frame close에서 getter를 읽고 geometry를 commit하던 경계와 sparse command list의 frame 유출을 실패하는 회귀로 재현했다. 종료 후에는 소스만 반환하고 geometry를 discard하며, sparse/잘못된 command count는 frame 생성 전에 거부한다. 최종 Root·recording26개와10 workspace 타입·diff/graph 검사가 통과했고 graph는944files/7,715edges/8SCC/design0/errors0이다. 정상 post-frame 변경·취소/stale/제출 억제/close·중복 소비·별도 image/shader lease·원래 입력 getter1회·foreign owner·0/undefined retirement·borrow rollback을 포함한다.

마지막 guard 변경 뒤 전체 scroll231개도 통과했다. 첫 새 Core 공급의 bytecode/Android build는 통과했지만 실제 Chrome3개가 공통 bootstrap의 copy-then-bind asset 경로에서 실패했다. 이 경로를 registry.captureResource의 identity·binding 단일 캡처로 옮기고 Image도 같은 owner를 사용한다. 실제 bootstrap의 원본 descriptor 변경·sealed owner·마지막 frame lease retirement 회귀를 실패→수정 통과로 확인했다. 관련 paint/recording/runtime/Engine39개와10 workspace 타입 검사가 통과했다. Core/SDK를 세 target에 다시 공급 중이며 §8.43은 직전 qualified 제품이다. 새 실제 두 Hermes·Web/Android 검증과 이후 RNW 기능/입력 확인은 구분한다. 전체 retained scene/text/geometry·성능/메모리/물리 수락은 계속 PARTIAL이다.

### 8.45 PASS-scoped — 소유 recording·asset capture의 제품 공급·외부 UIA

현재 Core archive `38a5f01c2cbeb48f39d0f9594eeb23b7d522d8cf02b51d2cbacfac052e39450b`, SDK `e1ee9ce414feccc4190977135dbd63d1edf538b3683278a2d890aa86dc52fa28`다. Core622src `f642edadf559190348d83e67ec1fec885a7f9208ff3473df6147a4c5983afd6a` /2,488dist `eb9b6ac33e4d67d488033d90c54840c6d1ea2e5850597fd178578f49527eda5a`, SDK112src `42caa0c9c5a919cbbf188d972ff8f881a732e129962c558e9e07aab2c09474fb` /448dist `b243497508c5f4ab03d32c37fa4bdb6d7801a28eb1ae49215901112a5f6b2e8e`다. Windows/Web/Android의 전체 독립 src/dist·source-map input guard가 일치하며 다른 archive/native source는 §8.43과 같다. HEAD는 `f59c049a28862d35348ddff417d7405894aa1f66`를 유지한다.

bytecode build58,120ms/PID10776/HBC `62bfd58cd7aa5bb8530f8dd4949b9ec932246072a1aa97dc936d97c2bf7713ad`, Static build470,764ms/PID20692/DLL `31d3e960d1bd00e9aefcdf91eeba5f647289d05e418d9458c20fba444cc94e87`를 확인했다. 두 실제 제품의 FIRST_FRAME·HWND/title·Responding=true·surface6/5·exit0/forced=false/error=null/stderr 없음, source860modules/11owners/generated3excluded·loaded79/80modules/noRN/noNodeAPIJSI가 일치한다. host EXE `4ec146cce1a107e9a41ae773e277110c10f9bb7de2952ae249969e8417e77870`, VM/native source는 §8.43과 같다. Static은 nativeFunctions37,192·app.hbc 없음이다. 설치 CLI native/RNW doctor와 두 모드 pack의 전체153/156files+manifest ZIP 크기/해시 대조가 통과했고 임시 ZIP은 finally 정리했다. RNW Hermes optimized/Release build192,704ms·EXE `df2d9425cadcb844b3dc7f426d7c4a8dd747d9da31733123522af0c08f6ed8b5`도 통과했다. 현재 RNW native input은 §8.42의1d0d…40f이며 추가 runtime 진단은 준비 중이다.

현재 SDK header로 native 검증 바이너리 `2bfd8413103b265e7036ecce38c87979d8bde4a54b76c60a86458677708a5d37`를 준비하고 native 계약10groups/2,908ms/exit0/stderr 없음을 확인했다. 실제 Hermes VM environment·callback·입력/trace,23opcode의 frame/PictureRecorder 픽셀과 atomic rejection, Vulkan forced-GC recording/drain·UIA snapshot/revision/retirement를 포함한다. OS 입력을 주입한 검사가 아니며 process/GPU driver·물리 표시·성능 수락은 별도다. graph944files/7,715edges/8SCC/design0/errors0·diff 검사도 통과했다.

Web check/build의 새 JS `1ba1c130bf1be2821996f6c287f2ce16f27b25bd65429d6a4e4be0b078b4d24d` /map `13457fbe278629f8dcd7f40ecc7ce8e2731c1f91e5c3ffcaf46415a903d281e8`에서 실제 Chrome 편집3개81,240ms·catalog1개10,901ms가 통과했다. CanvasKit은 §8.40과 같다. Android check·Release/x86_64/emulator-vulkan build69,741ms, APK66,039,796bytes `3245c7c0c429b333b5a1782085eed0cd433fe7928bac5b8de6667ebfa9ddbb6d`도 통과했다. adb 연결 기기는 없으며 기기 runtime/production signing은 notVerified다. 기존 Gradle/SDK XML 경고를 유지한다.

RNW queued/bounded/no-PC 진단은 빌드 뒤 WAIT_FOR_INPUT에서 대기했고 사용자의 새 3분 입력 독점 응답 후 실행했다. source `476ef174c1a12c19f0a3f01454d713008ccac967bc3984fa4230ec7b323a2e1d`, HBC `e5023938d5628d469e5b6eab620e70dbb1c4c2a9b21f83c1c0c0d0e6eee1247d`, 진단 host `7b24b9453585269fb6cb50ec65e0bf4c7f4f6a4b0d085602e623db18961a63e7`다. stock VM은 §8.43과 같다.10phases/입력48+9×240의 전달·처리·이동량, scrollCompleted/normalClose/exit0·JS/native 오류 없음을 확인했다. 전체821,198ms에는 빌드와 사용자 대기가 포함되며 정규 성능이나 과거 AV/VM PC symbol 해결의 증거가 아니다. queued 진단도 foreground하므로 두 README에 대기 gate를 반영했고 전체20분 안에서 cleanup 시간을 확보했다. 실행 소유 임시 폴더·fixture·config는 정상 finally 정리됐다.

같은 입력 독점 시간인2026-10-26 14:32~14:35 KST에 위 두 실제 native 제품의 외부 UIA focus/range4회72,188ms도 통과했다. focus는 두 모드 모두 sameOwner/sameId/hasKeyboardFocus/productNavigation=true, range는6 requests의 Material 절대/이산 값·thumb 순서·잘못된 값 거부·disabled/read-only·Cupertino를 확인했다. bytecode12/12/12·wheelY720/720, Static14/14/14·864/864로 입력량을 보존했다. surface는 focus13/15·range55/60이며 네 실행 모두 exit0/forced=false/error=null/clientError=null이다. source860/11owners와 loaded79/80/noRN/noNodeAPIJSI도 일치한다. 모든 창이 닫힌 뒤 사용자에게 입력 재개를 알렸으며 추가 입력 독점은 종료했다. 전체 R0~R7·정규 성능/메모리·물리 IME/reader/precision/display 수락은 계속 PARTIAL이며 기본 RNW/Hermes optimized를 유지한다.

### 8.46 PASS-scoped — 최종 recording 거부 앞뒤 geometry publication 경계

post-frame의 unbalanced 명령이나0을 던지는 getter로 최종 recording이 거부돼도 geometry는 먼저 commit되는 경계를 실제 CPU Root에서 재현했다. Root는 post-frame callback을 마친 뒤 소유 recording을 먼저 sealing하고 성공했을 때 geometry를 commit하도록 바꿨다. 실패 시 pending geometry를 discard하며, geometry 알림의 실패/owner close·Canvas close 중 Root retirement에서는 이미 sealing한 frame의 hold도 반환한다. Canvas close를 두 번 호출하지 않으며 캡처 실패의 원래 falsey 오류와 추가 retirement 오류를 보존한다. 별도 frame wrapper/새 mutable owner를 추가하지 않았다. Core 두 README에 geometry 알림 시점의 Canvas close와 paint/markNeedsPaint 이전 방법을 명시했다.

원래 구현에서 새2개 회귀가 먼저 실패했다. 실행 검사 대기 중에는 기본 transpile이 기존 dist와 정확히 일치함을 대조한 뒤 수정안만 메모리에서 검증했고, 입력 검사 종료 후 실제 소스에 적용했다. 실제 Core build·Root16개·scroll231·paint113·디자인266·native replay36·편집98·semantics12·10 workspace 타입·diff/graph 검사가 통과했다. notify 중 throw0/Root close·원본 getter·captured image hold·Canvas close 중 Root retirement/close1회·stale/suppressed/취소 계약을 포함한다. graph는944files/7,715edges/8SCC/design0/errors0이다. 새 Core의 세 target 공급과 아래 제품 검증을 확인했으며 마지막 외부 UIA/RNW 실행 진단은 §8.45 cohort다. 이 변경은 CPU capture 거부와 geometry notification 경계를 닫았으며 View admission/surface 연계·semantics 전체 publish transaction·text/retained scene·SDK composition은 계속 미완료다.

새 Core archive `8f68a0d22e395be023d8f982593d227a2ce731bd61ea06ca513a59c2a2fe50b3`,622src `d11fb15e1725e60fe4db17cffc6cd0fdb8e903240a4ddee292d6197b4dd461e5` /2,488dist `ddb2c1789fbca10d3b86683b69e368baba27ff8e8ab3331fa501deb359421426`를 세 target의 독립 전체 source/dist·source-map input guard와 대조했다. 다른 archive는 §8.45와 같다. bytecode build48,467ms/PID19392/HBC `7ece95f1e8f60b2ed87b89b8ab219ea35e9168a580c33255391f8b8c1bb7375d`, 실제 FIRST_FRAME·HWND/title·Responding=true·surface5·exit0/forced=false/error=null/stderr 없음·source860/11owners·loaded79/noRN/noNodeAPIJSI를 확인했다. host/VM/native source는 §8.45와 같다. 설치 CLI bytecode pack의153files+manifest ZIP 크기/해시와 finally 정리가 통과했다. Static의 현재 제품 검증은 아래와 같다.

새 Web JS `619b992c07ad9868323a92f2776f568806c422b01bc318881b7f7bb101084292` /map `d12a4e307599570a9a6e18fd46e8c48c13345fd20a2382c857c4e12d0a42658a`에서 check/build와 실제 Chrome 편집3개85,740ms·catalog1개11,493ms를 통과했다. CanvasKit은 §8.40과 같다. Android check·Release/x86_64/emulator-vulkan build77,067ms, APK66,041,112bytes `a584cf03d8ae90f583b37471e26ac0e1ee3bf5562678588796a2af14bcc57ece`도 통과했다. Android 기기 실행/production signing은 계속 notVerified다. RNW 현재 제품 build117,865ms와 §8.45와 같은 host EXE/native input을 확인했으며 새 Core의 RNW 실행/외부 UIA는 아직 수행하지 않았다.

Static build456,663ms/PID23632/DLL `4baa9fb5ee779718dfa66f9a28562c834b569f1cd50f559991b199d37426778b`도 통과했다. 실제 FIRST_FRAME·HWND/title·Responding=true·surface5·exit0/forced=false/error=null/stderr 없음, source860/11owners/generated3excluded·loaded80/noRN/noNodeAPIJSI를 확인했다. host/VM/native source는 bytecode와 같다. nativeFunctions37,191은 compile 분류이며 app.hbc는 없다. 설치 CLI Static pack의156files+manifest ZIP 전체 크기/해시 대조와 finally 정리도 통과했다. 두 새 제품의 추가 OS 입력/UIA 검사는 수행하지 않았으며 마지막 외부 UIA/RNW 실행 진단은 §8.45 공급이다.

다음 geometry 통합은 ViewRuntime.buildPending/pump/clearPending의 lease·교체 경계와 기존 controller.frameSubmitted를 대조한다. **forced frame은 GPU busy/zero-size에서도 동기 입력 질의에 최신 geometry를 제공하는 기존 계약**이므로 전체 geometry를 무조건 GPU 제출 뒤로 미루지 않는다. 논리 layout/query revision과 실제 frame/surface 연계를 구분하면서 RenderObject owner를 공유해야 한다. SemanticsTransportSnapshot·NativeInteraction의 snapshot/query lease·취소/교체 수명과 retained scene/text·SDK composition을 함께 이어간다. 이전 공급의 UIA·진단·시제품 성능은 새 공급으로 승격하지 않으며 전체 수락·기본 전환은 진행하지 않는다.

디자인 검사 명령을 한 번 잘못 지정한 뒤 실제 test:design-structure로 수정해 통과했다. 자동 승인 검토가 그때 생성한 `C:\Users\parti\AppData\Local\npm-cache\_logs\2026-10-26T05_41_03_082Z-debug-0.log` 삭제를 **blocked by policy**로 거부했다. 해당 삭제는 재시도하지 않았다. 최종 읽기 전용 존재 확인에서는 이 npm 로그는 없었고 §8.6/8.42의 기존 세 cleanup 거부 경로는 남아 있었다. 기존 세 경로의 삭제도 재시도하지 않는다.

### 8.47 PAUSED — 중간 마무리·일회성 검증 산출물 정리

2026-10-26 사용자의 중간 마무리 요청으로 전체 작업 목표를 **PAUSED**로 전환했다. 구현·추가 native/UI/성능 검증은 중지했으며 작업 소유 build/test/app process가 없음을 확인했다. HEAD `f59c049a28862d35348ddff417d7405894aa1f66`와 미커밋 구현을 보존했다. 현재 Core/SDK 공급·두 Hermes 시작/응답/정상 종료·pack·Web/Android/RNW build 결과는 §8.46, 마지막 외부 UIA/RNW 실행 진단은 §8.45다. 제품 PARTIAL·performanceAccepted=false·physicalInputAccepted=notVerified·displayed=unobserved와 RNW/Hermes optimized 기본값을 유지한다. 명시적 재개 요청 전에는 구현/native 검증을 재개하지 않는다.

`cleanup-w18-verification-once.ps1`(당시 생성했으며 현재 파일 없음)을 만들었다. 기본 모드는 목록만 출력한다. 삭제 대상은 직접 조사한 미사용 nested toolchain·이전 RNW supplier cache·남은 startup fixture, native 검증 EXE/객체 파일, 빈 build/work12 폴더와 사용자가 추가로 승인한 기존 runner fixture2개다. 추적 파일 예외는 `nelyx-animation-32204.tsx`와 `nelyx-animation-main-32204.tsx`의 정확한 두 경로·현재 내용 hash로만 한정한다. 변경되거나 현재 코드에서 참조하면 거부하며 그 외 추적 소스는 보호한다. 현재 제품/설치본/source/dist·공급 archive·현재 locator가 참조하는 pinned 입력은 삭제하지 않는다. 외부 경로·junction/reparse point·실행 중인 build/app/test도 거부한다.

저장소 루트 PowerShell에서 다음 순서로 실행한다.

```powershell
.\cleanup-w18-verification-once.ps1           # 목록 미리보기
.\cleanup-w18-verification-once.ps1 -Execute  # 실제 삭제
```

`-Execute -WhatIf`도 지원한다. 재생성 가능한 native host build/AOT object cache까지 비우려면 `-IncludeBuildCaches`를 추가한다. 이 옵션도 current-bytecode/current-static-aot 제품과 실제 pinned compiler/native 입력은 보존하지만 다음 build/UIA/native 계약 검사에서 host/test/object cache를 재생성해야 한다. 삭제는 사용자가 실행하며 자동 삭제·자기 삭제·새 로그/receipt/archive 생성은 하지 않는다.

PowerShell parser, Windows PowerShell5.1의 기본 대상+fixture2개와 PowerShell7의 추가 build cache `-Execute -WhatIf`가 통과했다. 실제 삭제는 실행하지 않았다. 읽기 전용 안전 검사6개(상위 경로 탈출·checkout root·미승인 추적 파일·현재 RNW supplier·수정된 승인 fixture·junction ancestor)도 통과했다. 이전 자동 승인 검토가 거부한 세 cache/fixture 경로는 이 수동 스크립트의 명시된 대상이며, 이번에는 실제 삭제를 재시도하지 않았다. npm 전역 cache/log는 대상에서 제외한다.

**재개점**: HEAD/diff·현재 source/dist/설치/locator를 §8.46과 대조한다. 정리 스크립트를 실행했다면 삭제한 native 검증 바이너리/선택 build cache부터 필요한 범위에서 재생성하고 과거 바이너리 hash를 현재 파일로 가정하지 않는다. 다음 구현은 ViewRuntime.buildPending/pump/clearPending·controller.frameSubmitted, RenderObject geometry owner와 SemanticsTransportSnapshot/NativeInteraction snapshot/query lease의 논리 revision·frame/surface 연계를 대조하는 작업이다. GPU busy/zero-size의 forced input geometry 계약을 보존한다. retained scene/text·SDK composition·전체 catalog/확장점·RNW AV/VM PC·R0~R7 및 최종 성능/메모리/물리 검증은 계속 남아 있다. 새 Core의 UIA/RNW 기능 검증은 §8.45의 이전 공급 결과로 대신하지 않는다.

### 8.48 IN_PROGRESS — 재개·CPU frame의 geometry/semantics publication

2026-10-26 전체 작업 요청으로 HEAD `76ca0f145b7a1ea7c22b265fcbec4a70ff446368`의 clean tree에서 재개했다. §8.47의 일회성 정리 스크립트는 현재 없으며 재생성하거나 삭제를 재시도하지 않았다. 12 workspace의 source-map input guard와 Windows/Web/Android의 Core·SDK 전체 src/dist 일치, §8.46 두 native package의 153/156 files·HBC/AOT identity, pinned VM manifest와 locator를 현재 파일로 확인했다. 이전 검증 EXE의 존재나 hash는 가정하지 않는다.

실패하는 회귀로 최종 recording/geometry 거부 전에 semantics가 게시되는 경계, host bind 중 Root close 뒤 새 binding의 미회수, capture/controller admission/이전 pending lease retirement 중 View close 뒤 교체 lease의 미회수를 재현했다. Root는 최종 recording sealing·geometry 성공 뒤 같은 CPU commit에서 semantics를 게시하며, 실패한 후보는 외부에 게시하지 않는다. post-frame 및 geometry notification 중 metrics 교체·visibility 변경도 후보를 취소한다. GPU busy/zero-size forced frame의 최신 논리 입력 geometry 계약은 유지하며 실제 제출/표시 완료와 구분한다. 보류 action은 성공한 snapshot 게시 뒤 실행한다. transport candidate는 최신 후보가 한 번만 commit할 수 있으며 교체·소비·invalidate 뒤 이전 action generation을 되살릴 수 없다.

첫 전체 758개 중 1개가 semantics 오류의 AggregateError wrapping 변경을 검출했다. 원래 오류를 그대로 전달하면서 추가 retirement 오류만 aggregate하도록 수정했다. 새 generation 검사의 초기 fixture에 빠진 source action 설정도 바로잡았고, 올바른 fixture가 이전 HEAD 구현에서 실패함을 소스를 메모리에서만 평가해 확인했다. 최종 103 modules/806개는 **803 PASS·3 조건부 SKIP·0 FAIL**(47,911ms), 10 workspace 타입·diff와 graph944files/7,715edges/8SCC/design0/errors0이 통과했다. Core README 두 언어에 publication과 action 시점을 반영했다. 새 Core의 세 target 공급·실제 제품/플랫폼 검증을 진행 중이다. 전체 W18-04/06/07/08·R0~R7 수락은 계속 PARTIAL이다.

### 8.49 PASS-scoped — 현재 제품 공급·native 설치 identity의 조기 거부

공급 뒤 실제 npm 설치를 갱신하기 전 Web/Android guard가 오래된 archive receipt를 거부했다. 직접 Hermes는 이 경계를 거치지 않고 이전 설치로 build할 수 있음을 확인했다. `nativePackageEnvironment`가 RN 초기화 없는 공통 `@nelyx/metro/installed-supply` 직접 subpath를 사용해 archive 위치·integrity·설치 receipt를 toolchain 준비·출력 생성 전에 검사하도록 수정했다. 실패하는 작은 독립 fixture에서 위치 불일치·integrity 불일치·누락 receipt와 정상 입력을 검증했으며, native tooling/source guard11개 중9 PASS·2 조건부 SKIP, Metro/CLI·신규 선언 타입, 기존 supply 교체/rollback1개가 통과했다. 버전이 같아도 실제 공급 설치를 갱신해야 한다는 기존 계약을 직접 host에도 적용한 변경이다.

현재 archive는 Core `303f4ec8f19ce07b8a232a40a1ea6683fd37bb66092854d81c7fd12b6bbbe547`, CLI `fd0200317d7c06c2b274ecd09b2f70550dbdea830f74e87cc3792a9e8848d1c6`, Metro `458af09be30d1b263f3e83e7a81ea7f4b81dbffdfe06e81d1d70770fe0aab1b1`이며 SDK는 §8.45의 `e1ee…fa28`과 같다. 세 target의 실제 설치를 갱신하고 archive receipt·Core/SDK 전체 src/dist·CLI/Metro 전체 src와 source-map guard 일치를 확인했다. source Root `c6c11a09e60f30141db7fd0c4da2c7c4ac3dd534fecc3d1d13a6b1342128d563`, ViewRuntime `7fff6a80d843750b4c61dfaa5d4cb11e47c577c8c28389ce231d0e236d57dabe`, semantics transport `f3e43f3d86af139c048df14a7d4fb7d60a27a108c1931b04209428b41325d0af`다.

새 bytecode build37,122ms/PID25936/HBC `eb0f20a1788e40b317a277105e918d568a705b0df907fd24c0fe415169eecdae`, Static build467,869ms/PID17444/DLL `5ea11e34b54bbe4923bbb641cc2265ee0d3f7133bbddce3cc39ad222e2c9a0ca`에서 실제 FIRST_FRAME·HWND/title·Responding=true·surface3/3·exit0/forced=false/error=null/stderr 없음을 확인했다. source860modules/11owners/generated3excluded·loaded79/80/noRN/noNodeAPIJSI가 일치하며 host/VM/native source는 §8.46과 같다. Static nativeFunctions37,191은 compile 분류이고 app.hbc가 없다. 설치 CLI native/RNW doctor와 RNW Release build108,589ms·EXE `df2d9425cadcb844b3dc7f426d7c4a8dd747d9da31733123522af0c08f6ed8b5`도 통과했다. 현재 native 검증 EXE `71c7ec453b1f0965ec70a09b6f40564d7038623d323ef66b116c478c7ad8d296`를 재생성해 실제 VM·23opcode 픽셀/atomic rejection·Vulkan GC/drain·UIA snapshot/retirement의10 groups를 통과했다(전체 build 포함24,319ms). OS 입력 주입 검사는 아니다.

Web check/build의 JS `6bcb13b21c0b44b1592fd33650d2867126eac6d4eb73d4da5bea8c3f1a0f9736` /map `4d783a00fc468cbcbf50e50d1e107e9ba5b7bf35c2cdf26d22e9d3a691a49772`에서 실제 Chrome 편집3개(28,448/26,183/26,830ms)·catalog1개11,713ms가 통과했다. CanvasKit은 §8.40과 같다. 첫 Android build는 기본 GraalVM21의 기존 jlink 문제로 실패했다. README에 기록된 Temurin21.0.11+10으로 process JAVA_HOME만 지정해 Release/x86_64/emulator-vulkan build를 통과했다. APK66,045,680bytes `062a1f9e660abadacae10f8b4509a15fe3a25db805e6e63e75e2e70665ed1545`다. 기존 SDK XML/Gradle 경고·Android 기기 실행/production signing notVerified를 유지한다. 설치 CLI로 두 모드 pack의153/156files+manifest 전체 ZIP 크기/해시를 대조했고 ZIP은 finally 정리했다. 첫 검증기의 Windows ZIP 구분자 가정만 수정했으며 내용 검사는 완화하지 않았다. 새 외부 UIA는 사용자 입력 독점 응답을 기다린다. 마지막 외부 UIA/RNW 실행 진단은 아직 §8.45 공급이다. 성능·메모리·물리·기본 host 전환은 수락하지 않는다.

### 8.50 PASS-scoped — §8.49 두 native 제품의 외부 UIA

사용자의 새 3분 입력 독점 응답 직후 §8.49의 두 제품을 외부 UIA로 검사했다. focus/range4회75,975ms 모두 정상 exit0/forced=false/error=null/clientError=null이며, 종료 뒤 검사 창/client process가 없음을 확인하고 입력 재개를 알렸다. focus는 두 모드 모두 sameOwner/sameId/hasKeyboardFocus/productNavigation=true, range는 각6 requests의 Material 절대/이산 값·thumb 순서·잘못된 값 거부·disabled/read-only·Cupertino를 확인했다. range 입력은 각12/12/12·wheelY720/720이며 surface는 focus14/13·range52/57이다. source860/11owners·loaded79/80/noRN/noNodeAPIJSI가 §8.49와 일치한다. 물리 IME/reader·precision/display·정규 성능 수락은 아니다.

### 8.51 IN_PROGRESS — 제출 중 close의 단일 lease owner

§8.49/8.50 공급과 별도로 ViewRuntime의 native submit·accepted observer·busy 응답 중 close 재진입을 실패 회귀로 재현했다. pending에서 submitting으로 같은 frame/lease를 이동해 close가 caller hold를 먼저 반환하지 않게 하고, 재진입 close만 authoritative submit 결과를 기다린 뒤 renderer drain을 시작한다. 일반 frame마다 Promise를 추가하지 않으며, 폐기한 controller의 frameSubmitted callback을 호출하지 않는다. 교체·admission 실패와 추가 retirement 실패가 함께 발생할 때 falsey 원래 오류도 보존한다. Registry의 기존 중첩 AggregateError 형태를 유지해 두 오류를 각각 검사한다. 새 Core build와 관련56개는 통과했으며, 전체 회귀·현재 공급은 진행 중이다. 이 source/dist를 §8.49/8.50의 실행/UIA 결과로 수락하지 않는다.

### 8.52 IN_PROGRESS — 문단과 selection fragment의 nominal 의존 방향

paragraph-fragment→boxes runtime 역방향 import를 구조 회귀에서 재현했다. fragment 생성 owner가 기존 canonical RenderParagraph constructor를 명시적으로 넘기고 fragment는 타입만 import하도록 바꿨다. 새 class/brand registry·callback wrapper·중복 paragraph 상태는 추가하지 않았다. 같은 constructor에 대한 실제 instanceof·사용자 Symbol.hasInstance의 receiver/falsey 오류 의미를 유지한다. 모든 기존 fragment 생성 소비자는 같은 단계에서 이전했으며 호환 분기는 남기지 않는다.

실제 CanvasKit의 nested selectable RichText/WidgetSpan에서3 fragment의 등록·부모/좌표·word selection/clear·최종 retirement와 동적 nominal hook을 확인했다. 초기 fixture의 structural 좌표를 source Offset으로 변환한 뒤 이전 구현의 의미 기준을 먼저 확인했다. 양방향 fresh ESM 초기화·기존 RichText State/scale/lease와 전체 타입이 통과했고 graph는944files/7,714edges/7SCC/design0/errors0이다. 새 Core는 §8.51과 함께 전체 회귀·공급을 진행한다. §8.49/8.50은 이 변경 전의 마지막 qualified 제품/UIA이며, 이 구조 검사 자체를 성능·물리 수락으로 바꾸지 않는다.

### 8.53 PASS-scoped — §8.51/8.52 통합 회귀·현재 제품 공급

두 변경을 묶은 최종103 modules/813개는 **810 PASS·3 조건부 SKIP·0 FAIL**(45,400ms)이며10 workspace 타입·graph944files/7,714edges/7SCC/design0/errors0·diff 검사를 통과했다. 현재 Core의 세 target 공급·실제 설치·두 native 제품·영향 플랫폼 소비를 확인했다. 최신 외부 UIA는 §8.50의 이전 공급 결과로 유지하며 새 source로 승격하지 않는다. 정상 submit에는 새 Promise/cleanup array를 만들지 않고, 재진입 close·실패 경계에서만 추가 owner 작업을 만든다. 남은7 runtime SCC·전체 text/geometry/retained scene·SDK composition·전체 catalog/확장점·RNW AV/VM PC·R0~R7와 최종 성능/메모리/물리 수락은 남는다.

§8.53 현재 Core archive는 세 target 모두 `cd233a3d9f9458a5b3d33a2a6f407ce864ac9ece64c35fbb83fab24d171149d3`다. archive receipt·Core/SDK 전체 src/dist·CLI/Metro 전체 src·source-map guard가 현재 workspace와 일치한다. ViewRuntime source `5e449ba43e825516cae75e6457add80ee2b907b8d7f51577ce6a95c9fb89f3e0`, boxes `edc77701dc5cd8cf8a7067fc88ea9db0f2006e558ea3d2d9387737a2793dff0e`, paragraph-fragment `0352f1f2293900ab9eaa4ef7047fd46614f7f36ecefd6b5dcf4d69b148d89f4b`다. bytecode build38,339ms/PID11056/HBC `dc7c4bc7834b4de79614dcae3f1beb5e9413cc3e95394caafa25c4729176f97d`의 FIRST_FRAME·HWND/title·Responding=true·surface3·exit0/forced=false/error=null/stderr 없음·source860/11owners·loaded79/noRN/noNodeAPIJSI를 확인했다. Static의 현재 검증은 아래를 따른다.

새 Web JS `2beffb1b273ec2b3784de3186b3b528a673d902349808decfbfa907cc98f2c24` /map `45a5c65259738613fbc919ce0d048a2678193ba6cbf2efb3df3939b3fd5727c5`의 check/build와 실제 Chrome4개88,963ms가 통과했다. Android check·Temurin21 Release/x86_64 build87,755ms, APK66,048,384bytes `9d24acbec3f15fe80bd580f2758775776d4f40c666bdcfcce102f10c73a6ecba`도 통과했다. 기기 실행/production signing은 notVerified다. RNW 현재 build132,236ms·동일 EXE `df2d…8b5`, 실제 PID26708/1784files/1404source-map modules의 HWND/title·Responding=true·exit0/forced=false/error=null/stdout·stderr 없음도 확인했다. 이 짧은 일반 시작/종료는 과거 AV·queued scroll·PC sampling 원인 해결 증거가 아니다.

현재 native 검증용 `host/NelyxNativeHostTests.exe`와 `host/CMakeFiles/NelyxNativeHostTests.dir`의 정리를 시도했으나 자동 승인 검토가 **blocked by policy**로 거부했다. shell은 실행되지 않았고 두 경로가 남아 있음을 읽기 전용으로 확인했다. 같은 삭제나 다른 도구로의 삭제는 재시도하지 않는다. 제품/설치본/현재 locator와 이전 거부 경로는 변경하지 않았다. 일반 ZIP·fixture 임시 경로는 각 finally에서 정리했으며, 이전의 없는 정리 스크립트 hyperlink는 역사적 파일명 표기로 바꿨다.

Static build483,832ms/PID26308/DLL `9a53da5477ba7a419bf5bf9b3f3b0071ef6113659bcd8b82ccf3945a6d3b7f8a`의 FIRST_FRAME·HWND/title·Responding=true·surface3·exit0/forced=false/error=null/stderr 없음도 확인했다. source860modules/11owners/generated3excluded·loaded80/noRN/noNodeAPIJSI가 현재 공급과 일치한다. nativeFunctions37,192는 compile 분류이며 app.hbc가 없다. 설치 CLI로 bytecode153/Static156files+manifest ZIP 전체 크기/해시를 대조했고 ZIP 임시는 finally 정리했다. 현재 두 package의 source/input guard와 남은 임시 staging 없음, `.tmp`와 package 임시 root가 비어 있음, 작업 소유 app/compiler process 없음도 확인했다. 현재 native/VM source identity는 §8.49와 동일하다. §8.51/8.52 변경은 현재 제품에서 실행되지만 최신 외부 UIA는 §8.50의 이전 공급 결과로 유지한다.

### 8.54 PASS-scoped — 같은 View owner의 입력·query admission과 완료 응답

실제 AppSession·FrameworkRoot·NativeInteraction에서 failed/closing 상태인데도 native/retained semantics action이 실행되고, 살아 있는 편집 연결이 좌표 질의·새 native 편집을 받는 경계를 실패 회귀로 재현했다. ViewControllerContext.readStatus()가 실제 ViewRuntime 상태를 읽고 Root의 action·pointer/keyboard admission·annotation query·geometry publication과 EditableText의 glyph query·focus/action을 같은 수명에 연결한다. 별도 mutable View 상태는 추가하지 않았다. 직접 만든 standalone context도 lifecycle reader를 제공하도록 같은 단계에서 fixture와 README를 이전했다. GPU busy/zero-size의 forced 논리 geometry 계약은 유지한다.

NativeInteraction과 Web EditContext/DOM은 새 입력과 query를 Core의 살아 있는 input state로 확인한다. input state는 연결별 readonly view 하나로 두며 질의마다 복제하지 않는다. 이미 보낸 programmatic 교체·조합 취소와 음수 receipt는 owner가 실패/종료 중이어도 완료할 수 있지만, 새 입력·재시도·focus 복원·action은 만들지 않는다. 조합 취소를 단순 입력 차단에 묶어 완료까지 버리는 경우도 실제 문단 회귀에서 검출해 수정했다. callback 중 disabled/binding/port retirement도 후속 focus/action을 거부한다. 전체 회귀·현재 설치/제품 공급과 외부 UIA는 §8.55에서 확인했다. 전체 W18/R0~R7 수락과는 구분한다.

실제 SDK를 대조해 native/RN close가 native 입력의 비동기 drain을 기다리기 전에 같은 View.beginClose()를 호출하도록 연결했다. 직접 host는 frame 취소 callback이 Close로 재진입하기 전에 종료 Promise를 게시하고, startup attach 중 close도 facade 생성 전부터 View를 닫는다. OS/GPU IO만 제어한 별도 Node process에서 실제 VM globals·application·engine·서비스의 일반/재진입 close를 확인했고, 실제 RN surface/engine 조립의 입력 drain 대기와 bootstrap attach 회귀도 통과했다. 이 IO 제어 검사를 실제 Windows 실행으로 대신 세지 않는다. 연결의 추가 View 참조는 같은 owner이며 mutable 상태 복사본이 아니다.

Core 통합109 modules/868개는 **865 PASS·3 조건부 SKIP·0 FAIL**(56,725ms), 후속 SDK/host 조립23 modules/178개는 **175 PASS·3 조건부 SKIP·0 FAIL**(8,496ms)이다. 두 묶음은 겹치므로 합산하지 않는다. 10 workspace 타입과 후속 SDK 타입, graph944files/7,714edges/7SCC/design0/errors0·diff를 통과했다. 실제 native/RN 조립 회귀를 기존 native 테스트 script에 등록했다.

### 8.55 PASS-scoped — §8.54 현재 제품·외부 UIA·플랫폼 소비

Core archive `c10a694c3e08a0bc9aeb9874ecbe874469c66797fad4d3a221ec2f3d086c8e88`, SDK `a560aa81a2ed2dfbce2fbeff82e01d5e3ee7b804536631931c9a99e781a75979`를 Windows/Web/Android에 공급·설치했다. archive receipt와 Core3,110/SDK560개의 전체 src/dist, CLI66/Metro32개의 src·source-map guard가 workspace와 일치한다. ViewRuntime source `4b00d890e4f07731c5909c6004ad248d44b2bd63514b2d4674d8c394879a1b55`, Root `054936e3068254932e6d97999cf1d0d686f70357003ce4aa2cd9f2652f1d7ff0`, native application `1e572b988d61fce7b1718dba2fa1e6e69affbfc230ecb835eb062980d1177922`다.

bytecode PID1880/HBC `086a0797205a1ee046ea6e21e93bd838b6eb60484691dd8638c4fb37048da95b`, Static build547,856ms/PID31668/DLL `97185f99963291ab679bc1fa3efea8075835fc85a9583d61e9899d1305a6f417`에서 실제 FIRST_FRAME·HWND/title·Responding=true·exit0/forced=false/error=null/stderr 없음을 확인했다. Static 종료 진단의 View 상태도 closing이다. 두 모드 source860modules/11owners/generated3excluded·loaded79/80/noRN/noNodeAPIJSI가 일치한다. host `1de3d309f82be64dbb8ffffe374cd390b37a3675614255d72c93e509e41d69dd`, VM `de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696`, native source `2af214c55d3e4483a153a5819cac45ed77f71ddbb3f734b44e24f293bd97ee09`이며 pin/toolchain/Skia 입력은 §8.53과 같다. Static nativeFunctions37,201은 compile 분류이고 app.hbc가 없다. 설치 CLI의 두 doctor와 두 pack ZIP154/157 entries 전체 크기/해시 검사가 통과했고 ZIP은 finally 정리했다.

새 3분 입력 독점 응답 뒤 현재 두 제품의 focus/range UIA4회를25,729ms에 통과했다. 준비된 client EXE의 현재 SHA가 §8.49의 `71c7…296`과 같고 native source/cohort도 동일함을 확인해 재사용했다. 두 focus는 sameOwner/sameId/hasKeyboardFocus/productNavigation=true, 두 range는 각각6 requests의 절대/이산 값·thumb 순서·잘못된 값 거부·disabled/read-only·Cupertino=true다. range 입력은 bytecode14/14/14·wheel864/864, Static12/12/12·wheel720/720이며 surface는 focus17/14·range56/57이다. 모두 exit0/forced=false/error=null이며 작업 소유 app/client0을 확인하고 입력 재개를 알렸다. 이 조건부 탐색의 서로 다른 입력량을 동일 부하 성능 비교로 세지 않는다.

Web check/build의 JS `a9cf841195636f9e126214e0a1f60e4a17e744179d484730c62b0ea8121dc5b4` /map `363bfd222a1fc796fb2cdfa99bb9c733c178ce58277a2fd2c5f54db0921af9f8`, 실제 Chrome 편집3·전체 catalog1개85,355ms가 통과했다. Android check·process Temurin21 Release/x86_64 build78,841ms, APK66,051,028bytes `215adcccd5f85377f21881fadd2171f760d0336d6950078497e6cfebab9de339`도 통과했으며 기기 실행/production signing은 notVerified다. RNW build155,441ms/1784files·EXE `85163811ac3ea77045ee162015cf320b5df3d70e2ce0954fa551a314f0bb8134`, 실제 PID32932의 HWND/title·Responding=true·수동작 없는 UIA Core 버튼 조회·exit0/forced=false/error=null/stdout·stderr 없음을 확인했다. RNW doctor 입력은 `1d0dcbc1ba296e975c885bdc697b6e6c8580be3ba81e67d37a54e379af98e40f`/1795files다. 과거 AV·VM PC·정규 성능/메모리·물리 IME/reader/display는 해결/수락으로 승격하지 않는다. §8.53에서 자동 승인 검토가 거부한 검증 EXE/obj는 재삭제하지 않고 남겨 둔다.

**다음 구현 경계:** RenderEditable.textLayout의 raw input과 TextPainter의 transport constructor/layout/measure, boxes.RenderParagraph와 source RenderParagraph의 _usesInlineSpan 분기를 대조해 canonical text/span/style·ParagraphContext owner로 실제 소비자를 이전한다. 관찰 가능한 getter/Proxy·nominal receiver·오류·문단/query/paint lease와 custom API를 보존하고 마지막 소비자 이전 뒤 옛 분기를 제거한다. layout/query revision과 실제 frame/surface association, retained scene·남은7 runtime SCC·공통 SDK의 async startup/close 계약·전체 catalog/확장점·RNW AV/VM PC·R0~R7 최종 성능/메모리/물리 수락은 계속 남는다. 기본 RNW/Hermes optimized를 유지하며 전체 목표는 **IN_PROGRESS / PARTIAL**이다.

### 8.56 PASS-scoped — 문단·편집의 source TextPainter 단일 경로

§8.55 뒤 새 Core 소스 작업이다. 마지막 qualified 설치/제품/외부 UIA는 §8.55의 이전 공급이며 이 변경을 검증한 것으로 재사용하지 않는다. RenderRichParagraph가 configuration·ParagraphContext로 source painter를 직접 소유하고 `_usesInlineSpan`과 중복 transport layout/scale/paint/hit 경로를 제거했다. boxes.RenderParagraph는 같은 nominal identity와 selection 수명만 가진 추상 base로 바꾸고 별도 raw input/options 저장·측정·layout·overflow를 제거했다. Source RenderParagraph·실제 RichText/WidgetSpan 소비자와 양 언어 README를 같은 단계에서 이전했다.

RenderEditable의 마지막 service/registry TextPainter 소비를 options의 InlineSpan과 ParagraphContext로 이전했다. painter가 source 설정과 geometry를 소유하고 편집기는 line policy를 보유한다. 편집기에서 raw input 동결·JSON key·정렬 재계산을 제거하고 source painter의 offset/width를 그리기·glyph/caret/native query에 사용한다. TextPainter의 transport 생성자/layout/measure·중복 paint geometry 저장·추가 입력 직렬화 key를 제거했다. source 측정은 동일한 캡처 문단을 실제 layout으로 넘기며, 최대2개 immutable geometry만 보유하고 측정 native producer는 동기적으로 반환한다. source 변경·detach/close에서 준비한 문단과 metric cache도 회수한다. native shaping·paragraph/query/paint lease·runtime 성능 수락을 이 구조 변경으로 대신하지 않는다.

새 실제 편집기 회귀는 이전 transport painter의 text 부재로 실패했고, 이전 뒤 방향/정렬6조합·비선형 scaler·문서 교체에서 같은 painter와 source 기준 geometry를 확인했다. span 캡처1회 재사용·독립 측정 retirement·falsey backend/cleanup 오류, 캡처/paint 중 close와 재진입 layout의 최신 결과 보존까지 실제 CanvasKit 문단/편집/inline56개가 통과했다. 이전 prepared 문단이 close 뒤 게시되는 실패도 재현해 source revision·native layout attempt를 완료 시 다시 확인하고 거절된 producer를 정확히 회수하도록 수정했다.

현재 Core/design·제어한 host IO의114 modules/876개가 통과했다. 이를 수집한115-module 실행에 실제 Windows animation host가 잘못 포함돼 그 빌드1개를 중단했고 finally 임시 정리를 확인했다(전체877개:876 PASS·1 FAIL/중단,140,235ms). 이를 전체 native 또는 전체 suite PASS로 세지 않는다. source preflight를 bytecode 설정으로 재시도한1회도 typed graph 선행조건으로 거부됐으며 제품 성공으로 세지 않는다. 앞선 넓은 실행의 Android2개는 준비된 serial 부재, native 문단1개는 삭제된 옛 입력 경로로 실패했다. adb 연결 대상은0개다. native 문단 검사는 실제 제품과 같은 prepared locator·schema·manifest hash를 검증하도록 이전했고 실제 C++ SkParagraph query/retirement1개13,132ms가 통과했다. 직접 SDK application/VM11개,10 workspace 타입, graph944files/7,708edges/7SCC/design0/errors0도 통과했다. 현재 공급·실제 앱 검증은 §8.57에 기록했으며 새 ZIP round-trip은 notVerified다.

`resolveTextInput`과 RichParagraphConfiguration의 잔여 raw descriptor/style 조립, layout/query와 실제 frame/surface association, retained scene·7SCC·SDK async startup/close·RNW AV/VM PC·R0~R7 최종 수락은 남아 있으며 전체 상태는 **IN_PROGRESS / PARTIAL**이다.

### 8.57 PASS-scoped / ZIP PARTIAL — source 문단·편집 통합의 현재 공급·실제 제품

Core archive `1283cdd9464aa396a5862f4628864ebd8cd99cef37be68cc2d4f288ba2bc3f5b`를 Windows/Web/Android에 공급·실제 설치했다. SDK `a560aa81a2ed2dfbce2fbeff82e01d5e3ee7b804536631931c9a99e781a75979`, CLI·Metro는 §8.55와 같으며 세 target의 archive receipt와 Core3,110/SDK560/CLI66/Metro32개 전체 src/dist 파일이 현재 workspace와 일치한다.12 workspace source-map guard도 통과했다. TextPainter source `2a5f23aca3de041d02f15aa050babc18434849e372bfb8d957a86e2964e04941`, RenderEditable `4231166765ee6159525ddd5cdd03598fc01c5705440be6c2dbececd2d8566c20`, source paragraph `a50c6ebf88c72e7f4572e01a612203258589226cc1301859195e0ed9da8968c2`, ui Paragraph `40ccbccd8143f611b3d9a250b66082b1bfe15653d0fcadbed9ea15b741e33dc4`다.

bytecode build44,637ms/PID26600/HBC `adddb370ef06ae080bb385ed5c73c50ddbbe879d3bc17c50559cb56edd93bcd8`, Static build554,177ms/PID26788/DLL `7eaf12cedefe9096e6a791f930d66da4d6b665d699e7d341c7e01c15eb68d59d`의 실제 FIRST_FRAME·HWND/title·Responding=true·exit0/forced=false/error=null/stderr 없음을 확인했다. 두 패키지153/156files·source860modules/11owners/generated3excluded·loaded79/80/noRN/noNodeAPIJSI가 일치한다. host·VM·native source·toolchain/Skia pin은 §8.55와 같다. Static nativeFunctions37,176은 compile 분류이며 app.hbc가 없다.

새 제품 준비 뒤 사용자의 새 3분 입력 독점 응답으로 외부 focus/range UIA4회를24,848ms에 통과했다. client SHA는 §8.55와 같은 `71c7…296`이고 native cohort도 같음을 확인해 재사용했다. 두 focus의 sameOwner/sameId/hasKeyboardFocus/productNavigation=true, 두 range 각각6 requests의 절대/이산 값·thumb 순서·invalid 거부·disabled/read-only·Cupertino=true다. range 입력 bytecode14/14/14·wheel864/864, Static12/12/12·wheel720/720, surface focus14/15·range58/55다. 정상 close 진단은 View closing/native[1,0,1,0,0]이며 모든 app/client 종료를 확인하고 즉시 입력 재개를 알렸다. 입력량이 다른 탐색 표본을 동일 부하 성능 비교로 세지 않는다.

Web check/build의 JS `b2663e5c18e7c45f6c46f9397da4b28a600dc7954d3771311ff3a061d233552b` /map `c4fb27df1f5c54129ec4be0591ff723963f8696db3b31b1a1ac4df2524c7968c`, 실제 Chrome 편집3·전체 catalog1개84,429ms가 통과했다. Android check·process Temurin21 Release/x86_64 build101,160ms, APK66,040,220bytes `6e9ea581717d0ba8978427f356aaea8f06ac512e0c5013ff1b15aa1beadd451d`도 통과했다. Android 기기 실행/production signing·물리 IME/reader/display·최종 성능/메모리는 notVerified/notAccepted다. RNW 현재 Release build123,899ms/1784files·EXE `85163811ac3ea77045ee162015cf320b5df3d70e2ce0954fa551a314f0bb8134`도 통과했다. 실제 PID30064의 HWND/title·Responding=true·수동작 없는 Core UIA 버튼 조회(ListView/Cupertino/Elevated 등)·exit0/forced=false/error=null/stdout·stderr 없음을 확인했다. 설치 CLI doctor2개도 통과했고 RNW native input은 §8.55와 같은 `1d0d…e40f`/1795files다. 과거 RNW AV·VM PC 문제의 해결이나 최종 수락으로 세지 않는다.

현재 두 제품의 설치 CLI pack ZIP 전체 대조를 위해 새 실행 전용 임시 폴더 생성·pack·ZIP read/hash·finally 재귀 삭제를 묶은 PowerShell 실행을 자동 승인 검토가 **blocked by policy**로 거부했다. 명령 전체가 실행되지 않아 ZIP·임시 폴더는 생성되지 않았으며 같은 삭제나 다른 도구로 우회하지 않았다. 현재 제품의 패키지 파일/manifest/hash·loaded identity 검증은 통과했지만 이 새 공급의 ZIP round-trip은 **notVerified**다. §8.55의 이전 ZIP PASS로 대체하지 않는다. §8.53에서 거부된 기존 검증 EXE/obj도 재삭제하지 않고 남겨 둔다. 전체 W18은 계속 **IN_PROGRESS / PARTIAL**이다.

### 8.58 PASS-scoped source — metric template·text/style·앱 font 알림

§8.57 뒤 새 Core 소스 작업이며 마지막 qualified 설치/제품/외부 UIA는 §8.57 공급이다. 같은 글꼴·run에서 strut만40px로 바꾸면 실제 문단은40px인데 OS/semantics editorStyle.lineHeight가24px로 남는 실패를 실제 편집기로 재현했다(`24 !== 40`). 기존 JSON metric key가 strut/locale/height 정책을 포함하지 않는 원인이며 임시 key 필드를 더 복제하지 않고 source TextPainter의 설정 변경·측정 invalidation으로 이전한다.

EditableState가 공백 template의 source painter와 immutable baseline view를 소유한다. source style/scaler·strut/locale/height behavior·font/context의 변화는 같은 painter에서 처리하고 측정 native producer는 매 호출 안에서 반환한다. 준비한 CPU 문단/metric은 해당 State 수명에만 보유하며 교체·unmount/close에서 회수한다. JSON key·일회성 painter 생성/폐기를 제거하고 State 종료도 metric·binding·selection notifier를 전부 시도하면서 falsey 오류를 보존하도록 바꿨다. 실제 strut-only 갱신·입력 binding 유지·line policy·retirement 회귀와 관련 검증은 진행 중이다.

실제 strut 회귀와 관련59개·후속 종료/입력24개가 통과했다. 이어서 RichParagraphConfiguration의 raw input·flattened placeholder array를 제거하고 font/scale·placeholderCount·InlineSpan/style/scaler·painter 정책으로 실제 Text/RichText/Icon/SelectableText/편집 소비자를 이전했다. config entry가 소비하는 필드와 option을 한 번 캡처한 frozen 소유 record를 보관하고 원래 source 객체 identity/receiver는 유지한다. caller 옵션 변경·불필요한 opaque getter·falsey font getter 실패가 현재 owner를 바꾸지 않는 회귀를 추가했다. 문단 config JSON 비교와 사용하지 않는 run/strut 직렬화, 마지막 selectable의 constructor+update 중복을 제거했다. 본문 flatten을 위해서만 있던 helper 인수도 제거해 resolveTextConfiguration(context, options, flags)로 바꾸고 저수준 API·callback 준비 시점 변경을 양 언어 README에 명시했다. 실제 Engine TextLayoutInput 검증/캡처와 자원·query/paint lease는 유지한다.

최종 source 전체114 modules/880개53,092ms가 통과했고 마지막 helper/선택 소비자 변경의 실제 RTL key·선택 paint·본문 교체/retirement를 포함한60개6,188ms,10 workspace 타입, graph944files/7,703edges/7SCC/design0/errors0·diff가 통과했다. 이 범위의 source 묶음 회귀는 통과했다. 후속 source 변경을 모아 검증하며 §8.57의 이전 앱/UIA를 새 소스 검증으로 세지 않는다. 앱의 실제 fontsChange가 새 font를 등록해도 편집 metric26px을 유지하는 실패(`26 !== 29`)도 재현해 수정했다. Root가 같은 앱 notifier를 BuildOwner·PipelineOwner에 넘기며, State의 metric painter와 RenderEditable 문단을 해당 View의 다음 frame에서 함께 갱신한다. 알림 중에는 dirty만 게시하고 resource retirement는 frame에서 수행한다. 두 실제 View·독립 font registry·반복 알림 coalescing·pending font callback 중 View close·listener0/문단 회수를 확인했다. 초기 두 View fixture는 중복 View ID로 실패해 명시적인 고유 ID를 지원하도록 수정했다. 최종114 modules/882개53,431ms·10 workspace 타입·동일 graph와 diff가 통과했다. layout/query와 실제 frame/surface association·retained scene·7SCC·SDK async startup/close·RNW AV/VM PC·ZIP 재검증 차단·R0~R7 최종 수락은 남아 있고 전체 목표는 **IN_PROGRESS / PARTIAL**이다.

### 8.59 PASS-scoped / UIA·ZIP PARTIAL — text/style/font 변경의 현재 제품

현재 두 native 제품은 이 절의 새 공급이며 마지막 외부 입력 UIA는 §8.57이다. 새 Core archive `58789365091132b4c3218132d754d7cee4d8f79efbb0f80ed8cae18cad3c76a8`를 Windows/Web/Android에 공급·실제 설치했다. SDK·CLI·Metro archive는 §8.57과 같고, 세 target의 npm receipt/integrity와 Core3,110/SDK560/CLI66/Metro32개 전체 src/dist byte 비교·12 workspace source-map guard가 통과했다. 새 제품의 빌드·실제 정상 시작/종료를 확인했다. §8.57과 다른 source를 이전 UIA로 수락하지 않는다. ZIP 실행 거부·검증 EXE/obj 삭제 거부 경로는 재시도하지 않는다. 새 desktop 입력 검사는 새 제품 준비 뒤 별도의 시작 시점 조율이 필요하며, 이전 3분 창은 이미 종료했다.

bytecode build52,853ms·PID7164/HBC `7b67da5e49733fa22440cecc7ee33d91721afeae6283c0a27fdb7fbd090f6087`의 FIRST_FRAME·HWND/title·Responding=true·surface3·View closing/native[1,0,1,0,0]·exit0/forced=false/error=null/stderr 없음,153files·현재 source860/11owners/generated3excluded·loaded79/noRN/noNodeAPIJSI를 확인했다. Static build573,876ms·PID22256/DLL `bffd30c9d7ee6d0de077c7150f489b367e49e325836d50e0fe7c9416ff3bd59f`도 같은 FIRST_FRAME·HWND/title·Responding=true·surface3·정상 View close/native[1,0,1,0,0]·exit0/forced=false/error=null/stderr 없음,156files·현재 source860/11owners/generated3excluded·loaded80/noRN/noNodeAPIJSI를 확인했다. nativeFunctions37,186은 compile 분류이고 app.hbc가 없다. host·VM·native source/toolchain/Skia cohort는 §8.57과 같다.

Web check/build JS `4d55cb4989eb1e4e302c1314d9cf9e23faa86a284c0bc25fbabb115837125c38` /map `6423041f4965606a6fcd58ca4168e1b5e9cbdfc2fb64ea3686a32cdbb80bfa6d`, 실제 Chrome4개86,892ms가 통과했다. Android check·process Temurin21 Release/x86_64 build81,029ms, APK66,041,676bytes `79ce6349c49654dc88ef1856e3824932b35518cabf62ec56c66db979c911ff45`도 통과했으며 기기 실행/production signing은 notVerified다. RNW Release build147,219ms/1784files·동일 EXE `85163811ac3ea77045ee162015cf320b5df3d70e2ce0954fa551a314f0bb8134`의 실제 PID26536 HWND/title·Responding=true·수동작 없는 UIA Core 버튼 조회·exit0/forced=false/error=null/stdout·stderr 없음도 확인했다. 과거 RNW AV·VM PC·물리 입력/display·최종 성능/메모리와 전체 W18은 여전히 미수락이다.

설치 CLI native/RNW doctor2개도 통과했으며 RNW 입력은 `1d0dcbc1ba296e975c885bdc697b6e6c8580be3ba81e67d37a54e379af98e40f`/1795files다. 이 공급에서 추가 desktop 입력을 주입하지 않았고 최신 외부 focus/range UIA는 §8.57의4회로 유지한다. 새 ZIP round-trip은 §8.57 실행 거부 뒤 재시도하지 않아 notVerified이며 이전 검증 EXE/obj 삭제 거부도 그대로다.

**다음 구현 경계:** FrameworkRoot.frameSubmitted()가 아직 scheduler의 first-frame marker만 갱신하는 경로와 ViewRuntime의 실제 accepted token을 대조해 text/layout/query의 논리 geometry·frame/surface 연관을 명시한다. GPU busy/zero-size에서 강제 논리 geometry를 허용하는 기존 계약은 보존한다. retained scene·남은7 runtime SCC·공통 SDK async startup/close·전체 catalog/확장점·RNW AV/VM PC·R0~R7 성능/메모리/물리 수락은 남는다. 기본 RNW/Hermes optimized와 전체 **IN_PROGRESS / PARTIAL**을 유지한다.

### 8.60 PASS-scoped — All components 두 열 elevated 카드의 native 그림자 깜빡임

2026-10-26 별도 버그 수정 요청으로 HEAD `f21660d`의 clean tree에서 시작했다. All components의445.5×119·radius12·elevation1 카드가 DPR2에서 이동할 때 Skia spot shadow가 특정 소수점 좌표에서 누락됐다. 실제 Vulkan 검사의 정수 좌표 shadow contribution100,516이 y423.69에서5,828, y394.497에서6,343으로 줄었으며, 직접 그리기와 RTree Picture 재사용 모두 같은 회귀를 보였다. Core의 카드 geometry·elevation·그림자 명령은 유지됐다. cache 비활성화·occluder flag 변경은 해결하지 못했고 채택하지 않았다. 이 절의 앱 검증은 두 열 배치 범위이며, 이후 보고된 한 열의 잔여 깜빡임과 대체 수정은 §8.62를 따른다.

공통 [`drawShadow`](Nelyx/skia/native/core/core.cpp)의 Graphite 경로에 `GetLocalBounds`로 계산한 임시 layer를 두어 그림자를 가까운 device origin에서 그린다. 불변 identity color filter 하나를 CPU 객체로 공유해 색을 유지하면서 SkPicture 최적화가 이 layer를 제거하지 못하게 했다. elevation·DPR·색·transparentOccluder 계약과 canvas save/restore를 보존한다. 추가 layer는 해당 Graphite recorder/recording의 자원이며 기존 GPU retirement로 회수한다. 이 추가 작업의 성능·메모리 증감은 이번에 측정하지 않았다.

[`native-hermes-host.cpp`](Nelyx/eng/tests/native-hermes-host.cpp)에 DPR1/2×직접/RTree×6좌표의24개 실제 GPU 회귀를 남겼다. fill-only 픽셀을 빼고 같은 카드의 정수 위치를 기준으로 dropout·overshoot를 검사한다. 수정 전8조건 실패를 확인했고, 새 공급의 전체 native VM·23opcode 픽셀/원자 거부·GPU drain·UIA 계약 검사와 함께 통과했다(빌드 포함69,521ms). 관련 packet/replay/native source 공급 회귀22개도 통과했다. 실제 All components 앱의 별도24좌표 readback은 수정 전 외곽 RGB contribution 최소16,197에서 수정 후279,394~308,814(정수 기준279,394)로 유지됐다. 이 readback은 물리 scanout이나 프레임 성능 수락이 아니다.

Windows runner의 Skia native/RN archive를 각각 `138cd8e8851afa34eed66c7584d4ed24b9a6ddc68f979956b2dc7d8c439d90cf` / `c08840d53c8fa79ec4df0223e9f0a9b8a2b2026e6dd9bd567cec052b47544c5d`로 공급·실제 설치했다. 원본·두 생성물·두 실제 설치의 `core.cpp` SHA-256은 모두 `fa4549b373245edfaad55b373fafda027f8c914080b250f7ca373b21c1999d73`다. 현재 두 제품의 native source digest는 `3005ceabc1bca7c301089dc5e1433f3b1b81679709c12e30833cf1a0179b2ac9`, host EXE는 `6e435b7ccac4ce981bc276eb481fc7dffe9c5f21da85781d701d044f33ec3403`이다. pinned VM/Skia 입력과 Core/SDK/Material 소스는 이전 공급을 유지한다.

bytecode30,050ms/153files/HBC `7b67da5e49733fa22440cecc7ee33d91721afeae6283c0a27fdb7fbd090f6087`, Static62,314ms/156files/DLL `0c97a0b4f3ed6ba8687bab4655f5cc653153bc729b4f4309c18e06fece96d8ca`를 빌드했다. Static은 두 C unit을 재사용하고 image를 재링크했으며 nativeFunctions37,186·app.hbc 없음이다. 두 실제 제품 모두 FIRST_FRAME·창 title·Responding=true·surface5·exit0/forced=false/error=null/stderr 없음, loaded79/80·noRN/noNodeAPIJSI를 확인했다. 기존 두 `run -- --host native-hermes --hermes-mode bytecode|static-aot` 명령으로 갱신된 제품을 실행할 수 있다.

진단 전용 entry/package는 실행별 finally에서 정리했고 루트 임시 helper 두 개도 삭제했다. 검증·공급 갱신은 Windows 직접 host 두 모드 범위다. 외부 입력 UIA·ZIP과 다른 플랫폼의 새 native 변경 실행은 이번에 추가 검증하지 않았다. W18의 다음 구현 경계와 전체 **IN_PROGRESS / PARTIAL**, `performanceAccepted=false`·물리 입력/display 미수락은 유지한다.

### 8.61 PASS-scoped — Web 전체 화면 높이·HTML 바깥 스크롤 방지

2026-10-26 기본 배율에서 HTML 스크롤바가 생긴다는 사용자 보고에 따라 HEAD `82bd578`의 clean tree에서 웹 러너만 수정했다. 기존 Chrome 기본 화면과 개발 모드 크기 변경에서는 원래 넘침을 재현하지 못했으므로 정확한 발생 조건을 확정하지 않는다. 기존 HTML은 `#app`의 최소 높이만 지정하고 앱 표면은 독립적인 `100vh` 높이를 사용했다. 개발 서버·정적 빌드 모두 `html/body/#app` 높이를 부모 기준 100%로 정하고 바깥 overflow를 숨겼다. `#app`을 세로 flex root로, Testbed·생성 템플릿의 표면을 `flex:1`·부모 높이 100%로 바꿨다. 포함형 SDK surface의 기본 크기나 canvas 내부 layout/scroll은 변경하지 않았다.

Metro·CLI만 새 archive로 Web에 공급·실제 설치했고 두 Metro 구현과 CLI 템플릿의 원본/설치 bytes 일치를 확인했다. Web check·현재 정적 build가 통과했다. 실제 Chrome의 개발/정적 두 모드 × DPR1/1.25 × 1200×900·390×740·1199×673의12조건에서 canvas·document client/scroll 크기가 viewport와 같고 페이지 scrollX/Y가0임을 확인했다. 네 모드/DPR 조합에서 실제 canvas pointer 선택·wheel40 입력으로 ListView 행이 이동하고 선택이 유지됐다. 개발 서버의 기존 favicon404는 별도로 구분했으며 다른 console error와 page error는 없었다. 임시 browser/profile·설치 디렉터리와 검증 서버는 finally에서 정리했다. 현재 개발 서버를 재시작한 뒤 페이지를 새로고침하면 적용된다. 사용자 환경의 원래 증상 재확인·물리 입력/display·전체 W18 수락은 별도이며 전체 **IN_PROGRESS / PARTIAL**을 유지한다.

### 8.62 PASS-scoped — 한 열에서도 방향성 그림자 메시를 스크롤 이동과 분리

2026-10-26 창 폭을 줄인 한 열에서 그림자가 계속 깜빡인다는 후속 보고로 HEAD `85766cb`의 clean tree에서 시작했다. §8.61 웹 변경을 보존했다. 카드 폭을691px로 바꾸자 §8.60 layer 수정이 적용된 실제 Vulkan에서도 기준 기여150,820이 y423.69에서8,283, y394.497에서9,042로 줄고 y511.269에서는264,372로 늘었다. layer 내부 device 이동이32/32.38처럼 작아도 같은 path의 spot 메시가39/43 vertices 또는 생성 실패로 달라졌다. layer 경계 clip을 추가하는 방법도 실패해 채택하지 않았다. 고정 [Skia 방향성 spot 생성](https://github.com/google/skia/blob/61e7ca4e99062cdd0ab69445d5963fb3365778f6/src/utils/SkShadowUtils.cpp#L137-L147)이 이동까지 포함한 CTM을 tessellator에 넘기는 경로를 확인했다.

공통 native shadow가 Graphite의 평평한 Z·방향성·affine 조건에서 device CTM의 이동을 제외하고 spot 메시를 만든 뒤, 원래의 소수점 이동과 device-to-global 변환으로 배치하도록 바꿨다. ambient·tonal 색·DPR/elevation·transparentOccluder는 기존 Skia 계산을 사용한다. perspective·지원하지 않는 조건과 메시 생성 실패는 Skia 경로로 돌려보낸다. §8.60의 임시 layer·identity filter는 제거했다. Picture에는 native shadow 명령을 유지하고, 공통 drawPicture의 proxy가 중첩 Picture를 실제 부모 matrix/clip에서 재생하며 같은 shadow 경로로 보낸다. JSI 단일/배치·frame wire·Graphite picture producer를 이 helper로 연결했다. 추가 mesh는 해당 draw/Graphite recording 수명으로 회수하고 proxy는 호출 안에서 종료한다. 전역 geometry cache나 추가 크기 제한을 두지 않았으며 ABI/wire·TS와 vendor pin은 바꾸지 않았다. proxy의 CPU 비용과 layer 제거 효과는 성능 측정으로 수락하지 않는다.

실제 native 회귀를 두 열445.5px·한 열691px의28조건으로 확장했다. DPR2의6좌표×직접/중첩 RTree를 두 폭에서 검사하고, DPR1은 두 폭×직접/중첩에 회전·비균등 scale·별도 device-origin layer·색/transparent occluder를 적용했다. 부모 save/matrix/clip 보존·fill-only 차감 그림자 유지·GPU drain과 전체 native VM/23opcode/원자 거부/수명/UIA 계약 검사가 통과했다(최종27,529ms, 앞선 제품 native 재빌드 포함 실행71,343ms). 관련 display-list/replay/source 공급14개720ms도 통과했다.

실제 All components의 bytecode 진단 앱을 새 프로세스로 실행해 아래30개 소수점 스크롤 위치에서 frame 외곽 RGB 기여를 확인했다. 한 열에서 높아지는 메뉴 영역을 반영해 카드를 viewport 안에 두었으며, 헤더에 가린 영역을 그림자 픽셀로 세지 않았다. 같은 위치의 직접 shadow 기준과 실제 retained frame의 기여 차이는 최대3.8%, 단일 channel 차이는 최대7이었다. 아래 범위는 픽셀 위상 변화가 포함된 관측이며 보편적인 성능/품질 제한이 아니다.

| 배치·카드 폭 | 좌표 수 | 외곽 RGB 기여 최소~최대 |
|---|---:|---:|
| 두 열445.5px | 8 | 276,860~297,000 |
| 한 열991px·열 전환 경계 부근 | 6 | 598,481~642,706 |
| 한 열691px | 8 | 421,604~452,584 |
| 한 열415px·compact | 8 | 258,866~277,309 |

Windows native/RN archive를 `ab6568d2c8dd5db59594b5957f5c7adcda819fe338e16670b1de0e05091b888c` / `8bb56e23d571934624dc2ba0e8ff1da6d24516b446495c189f64c2587ee3b8cf`로 공급·실제 설치했다. 원본·두 생성물·두 설치의 core.cpp는 모두 `2030e047ed48c6394048088e167185c1c8f6c4d3ae93707c284848d44b6b72ad`이며 네 generated/installed native-source guard가 각각161개 파일을 확인했다. 두 제품의 native source digest는 `ced0c7bab1c2fbacb11091c88074a43422007b69c8fa3e8d66950083bc14d531`, host EXE는 `7dce42a6a6a74f7887f4244cd8759e0506e4e615996ce8267cd0a63799b438e7`이다. pinned VM·Skia/toolchain은 §8.60과 같다.

bytecode29,023ms/153files/HBC `7b67da5e49733fa22440cecc7ee33d91721afeae6283c0a27fdb7fbd090f6087`, Static65,338ms/156files/DLL `605be444fe0920d199ea728f7c3bf2ab7be6ed7e6a4abd17050eef0f7fe328a9`로 현재 제품을 교체했다. Static은 두 native C unit을 재사용하고 image를 재링크했으며 nativeFunctions37,186·app.hbc 없음이다. 두 실제 제품의 FIRST_FRAME·창 title/Responding=true·loaded79/80·noRN/noNodeAPIJSI·exit0/forced=false/error=null/stderr 없음과 package/loaded image 일치를 확인했다. 기존 두 `run -- --host native-hermes --hermes-mode bytecode|static-aot` 명령으로 새 제품이 실행된다.

진단 entry/package는 실행별 finally에서 정리했고 루트 일회성 helper도 삭제했다. 이번 실행은 프로그램에 의한 스크롤/GPU readback과 두 제품 시작/종료 범위다. 물리 입력/scanout·성능/메모리 수락·다른 플랫폼의 새 native 변경 실행·새 외부 UIA/ZIP은 추가 수락하지 않는다. 전체 W18과 다음 구현 경계는 계속 **IN_PROGRESS / PARTIAL**이다.

## 9. 공식 원본과 적용 범위

아래 자료는 **2026-10-25** 확인했다. 원본의 일반 계약은 참고 근거이며 Nelyx에서의 개선율·ABI 호환·실제 플랫폼 지원을 증명하지 않는다.

| 원본 | 적용 범위 |
|---|---|
| [Flutter architectural overview](https://docs.flutter.dev/resources/architectural-overview), [Inside Flutter](https://docs.flutter.dev/resources/inside-flutter) | Widget/Element/RenderObject 역할·증분 build/layout·상태 보존을 참고. Flutter layout을 전부 C++ engine이 수행한다는 전제로 설계하지 않음. |
| [TypeScript: Erased Types](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types) | TS 정적 타입과 실제 JS 실행 자료구조를 구분. 별도 Static Hermes 특화 정책의 성공을 이 문서로 추정하지 않음. |
| [고정 Hermes pin의 직접 API](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/API/hermes/hermes.h) | 직접 runtime/SHUnit API의 source 경계. 실제 DLL export·CRT·JSI·compiler/runtime 공급 일치는 실행 시 확인. |
| [Emscripten Embind memory views](https://emscripten.org/docs/porting/connecting_cpp_and_javascript/embind.html#memory-views) | WASM kernel을 선택할 경우의 view/소유 메모리 수명. TypedArray 노출이 자동 수명 보장을 뜻하지 않음. |
