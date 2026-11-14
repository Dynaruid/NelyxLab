# work12 — Flutter 원본 충실 이식을 위한 프레임워크 전면 개편

작성일: 2026-11-14

상태: **설계 / 대표 경로 정적 검토 완료 / 전수 감사·제품 구현 미착수**

## 1. 개편의 목적과 이번 작업의 경계

목표는 **Flutter와 비슷한 API를 가진 독자 UI 엔진이 아니라, 고정한 Flutter 원본의 실행 의미를 TypeScript로 충실하게 이식한 프레임워크**다. TypeScript로 앱과 사용자 정의 위젯을 작성하는 방향은 유지한다. Dart UI로의 전환이나 Flutter 엔진 전체 도입을 이번 개편의 전제로 삼지 않는다.

사용자가 없애려는 것은 모든 Nelyx 작성 코드가 아니다. 없애야 하는 것은 원본 위젯을 다른 위젯 조합으로 대체하거나, 같은 이름의 스크롤·레이아웃·제스처·편집 정책을 native에서 별도로 결정하면서 그것을 원본 실행으로 취급하는 구조다.

이 계획은 아직 구현·빌드·실행하지 않았다. 제품 공급을 교체하지 않았으며, 이전 네 문서는 사용자 요청으로 STOPPED 처리해 이력으로 보관했다. [work11-1의 중단·V8 실패 기록](history/26/11/14/work11-1-summary.md#v8-진단과-마지막-정지-지점)을 해제하거나 V8 진단을 재개하지 않는다.

### 1.1 우선순위

1. 원본과 이식·플랫폼 경계를 고정한다.
2. 원본의 의미를 한 경로가 소유하도록 복원한다.
3. 동작을 대조하고 해당 범위의 대체 경로를 철거한다.
4. 그다음 실제 병목을 측정하고, 의미를 바꾸지 않는 최적화만 적용한다.

**원본 충실도와 성능은 서로 다른 수락 조건이다.** 이 개편만으로 현재 스크롤 정체가 해결된다고 주장하지 않는다. 반대로 기존 native 성능 목표를 유지하기 위해 원본 정책을 다시 임의 변경하지도 않는다.

### 1.2 이번 정적 검토의 범위

현재 Source 실행 경로, native widget adapter 등록, PageView·목록·grid, 렌더 투영과 사용자 훅, 제스처, 편집·Focus·semantics, scheduler·수명 확장, 변환 소유권, 별도 v2 Widget 계층을 조사했다.

이는 **아래에 적은 구체적 경로를 확인한 초기 감사**다. 전체 공개 선언과 모든 호출 경로의 전수 조사를 끝냈다는 뜻은 아니다. 전수 목록과 미조사 범위의 폐쇄는 W12-00의 필수 산출물이다. 정적 구조 차이, 실제 동작 차이의 증명, 성능 측정을 구분한다.

## 2. 원본과 증거의 기준

### 2.1 원본 revision을 먼저 확정한다

| 확인한 자료 | 확인한 사실 | 해석의 한계 |
| --- | --- | --- |
| [Flutter coverage](Nelyx/upstream/flutter-coverage.json) | 원본 revision은 `71e4717a61786faab4c7aa39825989305ed29e8a`로 기록되어 있다. | 실제 reference 전체가 해당 revision과 일치하는지 이번에 Git/blob hash로 전수 검증하지 않았다. |
| [수동 이식 출처](tools/Nelyx.FrameworkToTypeScript/data/work8/manual-origins.json) | 같은 Flutter pin, 원본 span·목적지·PARTIAL 범위가 기록되어 있다. | 파일 자체도 부분 출처만으로 구현 완료를 추론하지 말라고 명시한다. |
| [기존 framework imports](Nelyx/upstream/framework-imports.json) | 상위 revision과 Doroti/C# 출처, reviewed-port 등의 이전 기록이 남아 있다. | 이 기록 전체가 현재 Flutter 직접 이식의 활성 기준이라고 볼 수 없다. 서로 다른 기록의 존재만으로 현재 제품 오류를 확정하지도 않는다. |
| [로컬 Flutter reference](reference/flutter-master/packages/flutter/lib/src/) | 이번 구조 비교에 사용한 실제 Dart 소스다. | 디렉터리 이름의 master를 최신 기준이나 검증된 pin으로 취급하지 않는다. |

W12-00에서 **활성 원본은 하나로 확정**하고, 선언별 현재 출처와 과거 출처를 구별한다. 원본 pin·파일 hash가 확인되기 전에는 해당 reference 실행을 정식 oracle로 승격하지 않는다. 개편과 동시에 Flutter 최신 버전으로 올리지 않는다.

coverage에 기록된 Dart dev SDK/analyzer 정보와 이전 작업에서 사용한 시스템 Dart 버전은 서로 다른 종류의 기록이다. 어느 한쪽을 현재 설치 환경이나 전체 프레임워크의 빌드 가능성으로 단정하지 않는다. 선택한 pin의 언어 요구·lockfile·실제 도구 상태를 확인하며, 누락·불일치 확인 없이 SDK를 재설치하거나 예전 임시 SDK를 복원하지 않는다.

### 2.2 판정 용어

- **구조 불일치:** 원본의 책임을 별도 구현·우회 경로가 소유하는 것을 코드로 확인했다. 모든 입력에서 잘못된 결과가 나온다는 뜻은 아니다.
- **지원 차이:** 원본에서 가능한 입력·확장을 현재 경로가 제한하는 것을 코드로 확인했다. 현재의 명시적 PARTIAL 지원 자체를 숨겨진 버그라고 부르지는 않는다.
- **동등성 재검토:** 이식·최적화·확장이 존재하지만, 이번 조사만으로 의미 차이를 확정하지 않았다.
- **유지 후보:** 프레임워크 정책 대신 언어·엔진·플랫폼 경계를 담당한다. 새 경로의 계약 검증은 여전히 필요하다.

## 3. 현재 구조와 목표 구조

### 3.1 현재는 원본 이름과 실제 실행 소유자가 일치하지 않을 수 있다

[framework의 adapter 등록부](Nelyx/src/framework/widgets/framework.ts#L55)는 BuildOwner별로 위젯을 다른 위젯으로 바꿀 수 있게 한다. [현재 App host](Nelyx/runtime/app/host.ts#L487)는 편집·제스처·스크롤 adapter를 설치하고, Source build 이후 render 구성을 capture해 native Scene으로 보낸다.

동시에 [FrameworkRoot](Nelyx/src/framework/widgets/root.ts#L610)에는 Source build, PipelineOwner layout, PaintingContext paint와 합성 경로가 남아 있다. [Canvas](Nelyx/src/ui/canvas.ts)와 [Scene](Nelyx/src/ui/scene.ts)도 이미 존재한다.

따라서 문제를 해결하려고 세 번째 Widget/Element 트리를 새로 만들지 않는다. **기존 Source 실행 경로를 원본과 대조해 보수하고, 필요한 엔진 연결을 그 아래로 내리는 것**을 우선한다. 기존 경로라는 이유만으로 원본 충실도가 입증됐다고 간주하지는 않는다.

### 3.2 목표 실행 경계

| 책임 | 목표 소유자 | native에서 허용할 역할 |
| --- | --- | --- |
| Widget·Element·State·Key·Inherited 수명 | Flutter 원본 기반 TS 프레임워크 | 독립 reconcile·State 수명 정책 없음 |
| build·layout·intrinsic/dry query·paint 훅 | 원본 기반 TS RenderObject·pipeline | 텍스트 등 원래 엔진 서비스와 최종 그리기 실행 |
| hit test·gesture arena·recognizer·scroll physics | 원본 기반 TS 프레임워크 | 원시 입력·시각·장치 정보 전달, 렌더링 |
| 애니메이션·ticker·frame callback 순서 | 원본 기반 TS scheduler | vsync·timer와 실제 제출/표시 정보 제공 |
| 편집 값·formatter·selection/composing 정책 | 원본 기반 TS 편집 계층 | OS IME·clipboard·입력 연결과 glyph query |
| Focus·semantics 트리와 action 정책 | 원본 기반 TS 프레임워크 | OS focus·접근성 API로의 변환과 action 전달 |
| Paragraph·glyph shaping·image decode | 원본 엔진 경계에 대응하는 서비스 | Skia 등 실제 엔진 자원·질의 구현 |
| Picture·Scene·GPU·창·플랫폼 서비스 | 엔진·호스트 | 자원 수명, 합성, 제출, 복구와 플랫폼 연결 |

여기서 TS가 소유한다는 것은 GPU나 shaping까지 JavaScript로 구현한다는 뜻이 아니다. 반대로 C++에 있다는 이유만으로 삭제하지 않는다. 판단 기준은 **원본이 결정한 결과의 실행인가, 원본 대신 UI 정책을 결정하는 별도 구현인가**다.

## 4. 초기 감사에서 확인한 불일치와 후속 조사

### 4.1 감사 요약

| ID | 영역 | 현재 판정 | 개편 방향 |
| --- | --- | --- | --- |
| F01 | 위젯 단위 native adapter | 구조 불일치 | 원본 build를 대체하는 canonical 경로의 interception 철거 |
| F02 | PageView 구성·fraction | 구조 불일치 / 지원 차이 | 원본 구성·position·metrics·physics를 의존 계층과 함께 이식 |
| F03 | native scroll·페이지 준비 창 | 구조 불일치 / 지원 차이 | Source viewport·sliver·activity가 위치와 자식 수명을 결정 |
| F04 | gesture recognition | 구조 불일치 / 지원 차이 | 원시 입력부터 Source hit path·arena·recognizer를 실행 |
| F05 | native box·layout program | 구조 분리 확인 / 동등성 재검토 | 원본 Source layout 기준선을 먼저 복원하고 독립 정책 제거 |
| F06 | CustomPainter·render 훅·layer | 지원 차이 / 동등성 재검토 | 원본 훅을 실행한 뒤 범용 drawing·scene 계약으로 전달 |
| F07 | Grid·Material 날짜 native 등록 | 별도 lowering 확인 / 동등성 재검토 | 원본 delegate·sliver 경로로 통일, 위젯 전용 정책 의존 제거 |
| F08 | EditableText·native 편집 모델 | 구조 불일치 / 지원 차이 | Source 편집·RenderEditable와 플랫폼 입력의 책임 재분리 |
| F09 | Focus·keyboard | Source 실행 유지 확인 / 경계 재검토 | 기존 Source 로직을 보존하고 플랫폼 연결만 정리 |
| F10 | semantics | 별도 pipeline 확인 / 동등성 재검토 | 원본 의미 트리를 한 번 생성하고 OS로 변환 |
| F11 | lifecycle·scheduler·보관 확장 | 동등성 재검토 | 원본 수명·순서 검증, opt-in 확장과 기본 동작 구분 |
| F12 | 원본 출처·generated/adopted | 활성 기준 정리 필요 | 선언별 원본·변환·허용 차이를 추적 가능하게 정리 |
| F13 | 별도 v2 Widget 계층·공급 | 독립 모델 확인 | canonical 프레임워크의 우회 대안으로 사용하지 않음 |
| F14 | drawing·자원·플랫폼 연결 | 유지 후보 | 원본 엔진 경계에 맞춰 재사용·검증 |

### 4.2 F01–F03: PageView와 스크롤은 이름만 원본이어서는 안 된다

#### 확인한 차이

- [현재 PageView build](Nelyx/src/framework/widgets/page-view.ts#L279)는 LayoutBuilder 안에서 ListView를 조합한다. [Flutter 원본 build](reference/flutter-master/packages/flutter/lib/src/widgets/page_view.dart#L1007)는 Scrollable, Viewport, SliverFillViewport를 구성한다.
- [현재 fraction 검사](Nelyx/src/framework/widgets/page-view.ts#L33)는 `(0, 1]`을 허용한다. [원본 PageController](reference/flutter-master/packages/flutter/lib/src/widgets/page_view.dart#L121)는 양수 조건을 두며, 1보다 큰 fraction도 유효한 범위다. 이는 정적으로 확인되는 지원 차이다.
- [native scroll 옵션 검사](Nelyx/runtime/app/scroll.ts#L1253)는 reverse 등 여러 옵션을 거부하며, 기본 native PageScrollPhysics 경로의 fraction은 1로 제한한다.
- [native 목록 reset](Nelyx/runtime/app/scroll.ts#L864)은 일반 페이지 창 크기를 4로 정하고, 첫 native viewport 전에는 보이는 페이지 한 개로 좁힌다. Focus/KeepAlive 예외도 있으므로 실제 상주 수가 항상 4라는 뜻은 아니다.
- [native position](Nelyx/runtime/app/scroll.ts#L132)과 [C++ 페이지 ballistic·스냅](Nelyx/engine/core/scheduler/scheduler.cpp#L6)이 별도 위치·목표·이동 처리를 수행한다. [coverage 처리](Nelyx/engine/core/scheduler/scheduler.cpp#L738)는 요청 위치와 표시 가능한 범위를 구별한다.

캐시 기본값 0 자체가 잘못이라는 결론은 아니다. 원본과 같은 값이 있어도 **누가 언제 child를 build/layout/회수하고 이동을 결정하는지**가 달라지면 같은 실행으로 볼 수 없다. coverage 안전장치도 그 자체는 필요할 수 있으나 별도 페이지 정책을 정당화하지는 않는다.

#### 교체 범위

PageView 파일 하나를 수정하는 것으로 종료하지 않는다. 원본 PageController, PageMetrics, private position, PageScrollPhysics, ScrollPosition·Activity·Simulation, Scrollable, Viewport, SliverFillViewport와 고정 extent adaptor의 의존 폐쇄를 확인한다. [원본 widget](reference/flutter-master/packages/flutter/lib/src/widgets/sliver_fill.dart#L35)과 [원본 render sliver](reference/flutter-master/packages/flutter/lib/src/rendering/sliver_fill.dart#L33)까지 연결한다.

initialPage·keepPage·fraction·padEnds·방향·재생성·resize·notification·KeepAlive를 원본 규칙으로 실행한 뒤, 해당 native position 등록과 페이지 전용 창·스냅 interception을 제거한다. 일반 목록·grid·editor가 같은 파일을 사용하므로 [scroll 연결부](Nelyx/runtime/app/scroll.ts)를 한 번에 삭제하지 않는다.

### 4.3 F04: Source recognizer를 보관하는 것과 실행하는 것은 다르다

[현재 host](Nelyx/runtime/app/host.ts#L502)는 Source GestureBinding을 만들지만 App pointer dispatch·hit test·recognition을 제한한다. [RawGestureDetector adapter](Nelyx/runtime/app/raw-gesture.ts#L27)는 Source factory·recognizer 수명을 유지하면서, 정확한 prototype·일부 recognizer·slop·team 설정을 허용하고 native GestureDetector 구성으로 바꾼다. [일반 gesture adapter](Nelyx/runtime/app/gesture.ts#L278)도 지원 옵션을 선별하고 native 결과에서 Source callback 세부 값을 구성한다.

[Flutter 원본 GestureBinding](reference/flutter-master/packages/flutter/lib/src/gestures/binding.dart#L407)은 hit test 경로와 pointer dispatch·router·arena를 연결한다. callback 객체 모양을 맞추는 것만으로 경합·취소·slop·velocity·team 의미가 같다고 판단할 수 없다.

목표는 원시 입력부터 이식된 Source recognizer가 실행되는 한 경로다. 기존 C++ recognizer와 Source recognizer가 동시에 같은 pointer를 판정해서는 안 된다. raw sample 전달·좌표 변환·장치 정보는 유지하되 callback을 native 인식 결과에서 재합성하는 canonical 경로를 제거한다.

### 4.4 F05–F06: RenderObject는 native 설정 객체를 만드는 용도로 축소하지 않는다

[현재 capture](Nelyx/runtime/app/host.ts#L1020)는 native box·sliver·control 구성으로 render를 분류하며 instance 훅·일부 pointer/semantics 훅을 거부한다. [native box 계약](Nelyx/src/framework/rendering/native-box.ts)과 [box별 등록](Nelyx/src/framework/rendering/boxes.ts#L2752)은 native layout 구성을 공급하고, [C++ layout](Nelyx/engine/core/layout/layout.cpp)은 별도 치수·배치 처리를 수행한다.

[CustomPainter 처리](Nelyx/runtime/app/controls.ts#L98)는 일반 Source paint/hit/semantics 훅을 실행하는 경로가 아니라 등록 metadata를 요구한다. [layer 연결](Nelyx/runtime/app/layers.ts)은 Source link identity와 Content 소유 transform을 연결한다. 정확히 보존되는 경우도 있을 수 있으므로 모두 잘못된 수학이라고 단정하지 않는다. 다만 native 등록이 없다는 이유만으로 원본 확장점을 쓸 수 없다면 원본 충실 프레임워크의 기본 경계가 아니다.

원본 기준선에서는 Source RenderObject가 constraints, parentUsesSize, relayout boundary, dry/intrinsic, baseline, parent data, paint, hit test와 semantics를 결정한다. 사용자 subclass·custom painter도 해당 훅을 실제 실행해야 한다. [Flutter rendering binding](reference/flutter-master/packages/flutter/lib/src/rendering/binding.dart#L691)의 layout·compositing·paint·semantics 순서와 [PipelineOwner](reference/flutter-master/packages/flutter/lib/src/rendering/object.dart#L1020)를 비교한다.

기존 [FrameworkRoot](Nelyx/src/framework/widgets/root.ts#L649), [PipelineOwner layout](Nelyx/src/framework/rendering/object.ts#L977), [Canvas](Nelyx/src/ui/canvas.ts), [Scene](Nelyx/src/ui/scene.ts)을 먼저 재사용·보수한다. 단순 adapter 비활성화만으로 이 경로의 전체 API·엔진 연결이 완성됐다고 가정하지 않는다.

layout program이나 고정 명령 공유는 원본과 동등한 실행 표현일 수도 있다. 그러나 독립 정책을 제거하는 기준선을 먼저 확보해야 한다. 이후 유지하려면 원본 대응·훅 관측·오류·재진입까지 동등함을 증명해야 하며, custom subclass를 별도 의미로 처리해서는 안 된다. 증명되지 않은 native 실행을 지원 범위 확대의 전제로 삼지 않는다.

### 4.5 F07: 날짜 선택기·grid 전용 경로도 대상이다

[native grid](Nelyx/runtime/app/grid.ts)는 일부 regular grid를 목록 행이나 viewport layout program으로 바꾼다. [delegate 등록부](Nelyx/src/framework/rendering/native-grid.ts)는 정확한 prototype·메서드 identity를 검사한다. [생성된 날짜 선택기 끝부분](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2802)에도 날짜·연도 delegate의 native 등록이 추가되어 있다.

이 등록은 원본 숫자 정책의 lowering을 의도하므로 현재 픽셀이 틀렸다고 단정하지 않는다. 그러나 생성 파일이라는 이름만으로 원본 Dart 실행과 동일하다고 할 수는 없다. 원본 delegate의 layout, sliver child manager, key 이동, semantics와 사용자 delegate 확장이 실제로 실행되는지 대조해야 한다.

목표는 날짜 선택기를 위한 새 C++ grid를 만드는 것이 아니다. 원본 grid/sliver 경로를 복원하고, Material·Cupertino가 일반 프레임워크 위에서 실행되게 한다. 날짜 전용 viewport 정책과 생성기 주입의 퇴역 여부도 함께 결정한다. product 파일 끝부분만 지우고 재생성 때 다시 삽입되게 두지 않는다.

### 4.6 F08–F10: 편집·Focus·접근성은 유지할 경계와 대체된 정책을 구별한다

[편집 bridge](Nelyx/runtime/app/editing.ts#L35)는 Source controller·formatter·undo·focus를 유지한다고 명시하면서 native editable 구성과 비동기 authoritative edit transport를 사용한다. 동시에 일부 scrollPhysics·strutStyle·textAlign을 거부하고, native가 caret·scroll·password paint 등을 담당하도록 한다. 이는 OS IME 연결만 있는 얇은 bridge는 아니다.

[원본 EditableTextState](reference/flutter-master/packages/flutter/lib/src/widgets/editable_text.dart#L2562)와 [RenderEditable](reference/flutter-master/packages/flutter/lib/src/rendering/editable.dart#L267)를 기준으로 편집 값·selection/composing·caret·reveal·입력 순서의 소유자를 재정리한다. OS IME·clipboard·TSF 등의 transport와 Paragraph glyph 질의는 유지 후보이며, 모두 TS로 재구현하라는 뜻이 아니다.

[Focus bridge](Nelyx/runtime/app/focus.ts#L124)는 Source focus·shortcut 실행을 유지한다. 이를 독자 Focus 구현으로 단정해 버리지 않는다. 다만 native focus session, 비동기 관측 geometry, 원본 traversal·reveal·키 전달 순서가 만나는 경계를 확인해야 한다.

[semantics bridge](Nelyx/runtime/app/semantics.ts#L26)는 TS semantics/layout pipeline을 붙이지 않고 native publication의 geometry·action을 연결한다고 명시한다. 의미 트리의 병합·순서·identity·action은 원본 Source pipeline이 한 번 결정하고, native는 OS API로 변환하는 경계로 맞춘다. publication·generation·stale action 방어는 별개로 유지한다.

단순 버튼 callback이나 가짜 editor로 전체 입력·IME·스크린 리더 검증을 대신하지 않는다. 현재 유지되는 Source 로직과 자원·세대 방어도 adapter 철거 과정에서 함께 삭제하지 않는다.

### 4.7 F11: lifecycle·scheduler의 기존 확장을 기본 오류로 몰지 않는다

[BuildOwner](Nelyx/src/framework/widgets/framework.ts)는 자체 dirty queue·transaction과 선택적 보관 연결을 사용한다. [FrameScheduler](Nelyx/src/framework/scheduler/scheduler.ts)는 host-driven·밀리초 단위 adaptation이다. 이 사실만으로 원본 수명이나 순서가 틀렸다는 증거는 아니다.

[child policy 정규화](Nelyx/src/framework/widgets/view-work-budget.ts#L19)는 미지정 시 `legacy`이고, [DormantChildCache](Nelyx/src/framework/widgets/dormant-child-cache.ts)는 opt-in 정책이다. 현재 모든 목록이 기본으로 dormant/bounded라는 설명은 하지 않는다.

다음은 원본 trace로 검사한다.

- dirty build 순서, build 중 setState, callback·microtask·post-frame 순서와 오류 처리.
- GlobalKey 이동, deactivate·activate·frame-end unmount, Inherited 의존·누락 조회, 재진입.
- relayout·repaint boundary, ticker·visibility·시간 단위 변환, 여러 View의 소유권.
- opt-in 보관이 canonical 기본 수명에 섞이는지, native 자원 회수가 State 보관 정책으로 변질되는지.

원본과 동등한 자료구조 최적화는 보존할 수 있다. 별도 제품 확장은 canonical 동작과 분리하고 승인 범위를 명시하거나 퇴역시킨다. 비활성 코드를 활성 기본 경로의 원인으로 집계하지 않는다.

### 4.8 F12–F13: 출처 라벨과 별도 Widget 계층도 정리한다

[변환 도구](tools/Nelyx.FrameworkToTypeScript/README.md)와 [소유권 안내](tools/Nelyx.FrameworkToTypeScript/data/README.md)는 generated/adopted 출력·직접 제품 변경·부분 검증을 구별한다. 파일명의 generated, 클래스명의 Original·Canonical·Native, 포맷·타입 검사 PASS는 원본 동작 증거가 아니다.

[Material3-only adoption](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-m3-scroll-adoption.json)은 이전 사용자 지시에 따른 명시적 제품 정책이다. 이를 무단 native 위젯 대체와 동일하게 취급하거나 이번 문서만으로 철회하지 않는다. 원본 기본값과의 차이·유지 승인·지원 profile을 명시하고, oracle는 같은 원본 설정으로 실행한다. 기대값을 맞추려고 oracle 원본 자체를 고치지 않는다.

또한 [v2 Widget 계층](Nelyx/runtime/engine-client/widgets.ts#L21)은 별도 Widget·State·Element 모델이고, [패키지 export](Nelyx/package.json)는 v2와 original 경로를 별도로 공급한다. 같은 이름이나 비슷한 callback을 원본 Source의 identity·수명으로 간주하지 않는다.

canonical 앱의 실패를 다른 Widget 모델로 우회해 성공 처리하지 않는다. 공개 소비자가 있다면 버전·이전 절차를 제공하고 주 프레임워크에서 분리·퇴역한다. 저수준 engine client를 유지하는 것과 두 번째 UI 프레임워크를 계속 유지하는 것은 구분한다.

### 4.9 추가 전수 조사 의무

위 대표 경로 외에도 다음은 W12-00에서 빠짐없이 목록화한다. 이번 문서에서 동등성을 확인한 영역으로 표시하지 않는다.

- foundation 값·컬렉션·key·진단, Dart 수치·동등성·타입 의미.
- 애니메이션·physics·scheduler 전체, 중첩 gesture와 pointer signal·pan/zoom·mouse tracker.
- Navigator·Router·Overlay·Hero·전환·restoration·PageStorage와 route 수명.
- text selection·selection container·Focus traversal·Actions·Shortcuts·메뉴·tooltip.
- image provider/cache/stream·font·asset·localization·theme·directionality·platform defaults.
- Material·Cupertino의 generated/adopted·수동 구현, 지원하지 않는 생성자·옵션·확장점.
- SDK runner·템플릿·CLI·package export가 실제로 선택하는 framework/renderer 경로.

## 5. 허용하는 adaptation과 금지할 대체 구현

### 5.1 허용하는 경계

- Dart 문법·mixin·named parameter·collection 등을 TS로 표현하는 검증 가능한 변환.
- 원본 native API에 대응하는 Paragraph·Picture·Scene·image·font·platform message 연결.
- window·GPU·OS 입력·IME·clipboard·접근성 transport와 자원 회수.
- 결과·호출 순서·수명·오류를 보존하는 dirty queue·불변 저장소·retained drawing 최적화.
- 별도로 승인·표시한 제품 정책. 원본 전체 호환 주장과 혼합하지 않는다.

기존 [텍스트 서비스](Nelyx/runtime/app/text.ts), [자원 보존](Nelyx/src/ui/resource-retention.ts), Canvas·Scene과 native 렌더러는 재사용 후보이지 폐기 기본값이 아니다. 다만 새 Source API의 동기 질의·자원 수명·fallback·오류 계약을 다시 검증한다.

### 5.2 원본 경계 계약

1. 원본의 동기 layout·measure·hit test API를 임의의 Promise·나중 callback으로 바꾸지 않는다. 필요한 engine 서비스는 해당 Source owner에서 같은 의미로 호출 가능하게 공급한다.
2. 원본이 결정한 layout·paint·semantics 결과를 전달한다. native가 동일 위젯을 다른 트리로 다시 구성하지 않는다.
3. native의 ACK·제출·표시·복구 상태와 Source의 State·위젯 수명을 구별한다. 자원 hold가 State를 임의 보관하거나 반대로 State dispose가 보유 프레임 자원을 조기 해제해서는 안 된다.
4. 원본 입력·phase 순서를 지킨다. native가 늦은 Source callback을 생략하거나 자체 callback을 추가하지 않는다.
5. 불변 snapshot·세대·메모리 예산·stale 응답 검사는 보존한다. 예산 초과는 명시적으로 실패시키며 cache/State 정책을 몰래 바꾸지 않는다.
6. device·metrics·font cohort 변경과 shutdown의 취소·회수·join을 유지한다. raw pointer나 graphics resource 수명은 프레임워크 충실도와 별도의 필수 계약이다.

### 5.3 금지하는 접근

- 성능을 이유로 PageView·달력·editor·버튼을 native 특수 위젯으로 계속 추가하기.
- callback 형태·픽셀만 맞추고 원본 layout·recognizer·semantics 실행을 생략하기.
- 실패 시 다른 renderer·위젯 모델·고정 크기·기본 폰트로 조용히 전환하기.
- 지원하지 않는 훅을 무시하거나 오류를 지워서 호환으로 표시하기.
- native 전용 생성자·opt-in을 사용해야 원래 Flutter 위젯이 정상 동작하도록 만들기.
- 원본을 고치지 않고 생성 결과·dist만 수정해 재생성 때 대체 경로가 돌아오게 두기.
- Flutter 엔진을 컴파일하면 Dart 프레임워크가 C++ API로 바뀌거나 TS 트리를 바로 받는다고 가정하기.

## 6. 작업 묶음과 선행 관계

각 묶음은 **원본·변경 경계 확인 → 최소 구현 → 원본 대조 → 제품 경계 확인 → 해당 대체 경로 철거**로 종료한다. 아래 ID는 실행 계획이며 현재 완료 표시가 아니다.

| ID | 작업 | 직접 선행 조건 | 종료 조건 |
| --- | --- | --- | --- |
| W12-00 | 활성 원본·공개 surface·실행 owner 전수 목록 | 없음 | 원본 pin/hash 기준, 선언별 출처·우회·지원·미조사 항목과 사용자 승인 차이를 기록 |
| W12-01 | 변환·언어 의미·foundation 기준선 | W12-00 | 원본 대응 변환·명시적 overlay를 재생성 가능하게 만들고 언어·lifecycle 핵심 대조 통과 |
| W12-02 | 원본 엔진 경계와 backend 연결 계약 | W12-00 | drawing·text·image·raw input·platform transport를 widget 독립 계약으로 공급 |
| W12-03 | 단일 Source framework·frame pipeline | W12-01, W12-02 | 기존 FrameworkRoot를 보수해 build/layout/paint/semantics를 한 owner 경로에서 실행 |
| W12-04 | 원시 입력·hit test·gesture 경로 복원 | W12-03 | Source path/arena/recognizer 실제 실행, 중복 native 판정·callback 합성 제거 |
| W12-05 | PageView 원본 세로 단면 교체 | W12-04 | 원본 position·physics·viewport·sliver 연결, F02/F03 해당 native 경로 철거 |
| W12-06 | List/Grid·lazy child·cache/keep-alive 정리 | W12-05 | 원본 child manager·delegate 실행, 일반·날짜 grid 전용 정책 의존 제거 |
| W12-07 | 편집·Focus·semantics 경계 교체 | W12-05 | 원본 편집·geometry·접근성 경로와 실제 OS transport의 수명·순서 검증 |
| W12-08 | 나머지 위젯·디자인 패키지·SDK 통합 | W12-06, W12-07 | 전수 목록의 나머지 의존 폐쇄를 이식하고 canonical import·runner·템플릿으로 연결 |
| W12-09 | 플랫폼·제품·성능 수락 | W12-08 | 원본 대조와 각 대상의 실제 입력·시각·접근성·성능 결과를 분리해 판정 |
| W12-10 | 잔여 경로·export·생성 주입 최종 철거 | W12-09 | canonical 공급에 대체 Widget·정책이 없고 재생성·재빌드 뒤에도 되돌아오지 않음 |

W12-01과 W12-02는 원본·계약이 확정된 범위에서 병행할 수 있다. 각 세로 단면의 이전 경로는 대조 통과 후 해당 단계에서 정리한다. W12-10까지 모든 이전 구현을 계속 활성 상태로 남겨 두라는 뜻은 아니다.

### 6.1 W12-00: 전수 목록에 필요한 필드

선언·공개 옵션·확장점·runtime entry별로 다음을 현재 상태 한 곳에 기록한다. 새 이력 JSON·receipt 체계를 추가하지 말고 기존 소유권 데이터와 이 문서의 상태표를 우선 활용한다.

- canonical package/export, 현재 파일·실행 entry와 실제 선택 runner.
- 원본 repository/revision/file/symbol/span, 현재 출력과의 연결.
- 자동 변환·검토 이식·언어 adaptation·엔진 binding·승인 제품 정책·독자 대체·미지원 중 분류.
- 실제 의미 소유자와 adapter/metadata/native 분기, 중복 state/tree/physics 여부.
- 지원 제한·의존 선언·대조 방법·남은 판정과 철거 담당 단계.

단순 검색으로 native 문자열 수를 세거나 generated 비율을 계산한 것을 전수 의미 감사로 대신하지 않는다. 등록부의 설치·호출·runner 선택까지 연결해 활성 여부를 확인한다.

### 6.2 W12-01: 자동 생성 범위를 과장하지 않는다

[현재 변환기](tools/Nelyx.FrameworkToTypeScript/README.md)는 명시적 규칙·소유권을 사용하는 도구이지 전체 Flutter를 무조건 변환하는 compiler라고 가정할 수 없다. 지원하지 않는 구문·의미는 진단으로 중단한다. 손으로 비슷한 위젯을 만들어 통과시키지 않는다.

허용한 수동 이식도 원본 대응과 이유·검증 범위를 추적해야 한다. 기존 제품 직접 수정·base fingerprint·라이선스·출처는 보존하고, 현재 변환 규칙이나 검토 가능한 overlay로 재현 경로를 마련한다. validator가 사라진 recipe를 무작정 일괄 resume/promote하지 않는다.

null/undefined, int/double·signed zero·무한대·rounding, equality/hash/identity, generics·runtime type, collection 순서, exception·callback·async/microtask 중 실제 의존하는 의미를 검증한다. 타입 검사나 같은 클래스 이름만으로 대체하지 않는다.

### 6.3 W12-02–W12-04: Source 기준선이 첫 실행 가능한 산출물이다

빈 창·고정 박스·텍스트·사용자 정의 RenderObject/CustomPainter로 Source layout·paint·hit test를 실행하고, 원본에서 내려온 drawing·resource 결과만 native가 소비하도록 연결한다. 이 최소 화면부터 native 위젯 whitelist를 요구하지 않아야 한다.

native의 GPU·Paragraph·자원 관리 전체를 새로 만들지 않는다. 기존 공급을 재사용할 수 있는 API는 재사용한다. 반대로 기존 독립 C++ layout·scroll 엔진에 Source 결과를 다시 UI 트리로 번역해 정책을 재적용하면 경계를 복원한 것이 아니다.

frame·input·semantics phase가 다른 스레드/owner에 걸쳐 있더라도 의미 owner는 하나다. 같은 View에 두 GestureBinding 판정이나 두 Element 수명 소유자를 붙이지 않는다.

### 6.4 W12-05: 첫 제품 단면은 PageView로 닫는다

처음에는 PageView로 범위를 좁히되 관련 의존 계층을 빠뜨리지 않는다. calendar 최적화부터 재적용하지 말고 다음을 일반 페이지 예제로 먼저 닫는다.

- 가로·세로, reverse·RTL, fraction이 1보다 작은 경우·같은 경우·큰 경우, padEnds.
- initialPage·keepPage·PageStorage, controller 교체·attach/detach, jump·animate·사용자 입력 중단.
- drag·fling·reverse·resize·빈 목록·자식 수 변경·Key 이동·KeepAlive.
- notification depth·page 반올림 경계·onPageChanged 횟수·순서, scroll activity와 취소.

그다음 같은 경로에 기존 날짜 선택기를 올린다. 물리 입력·전체 성능 결과가 남았다면 기능 대조만으로 제품 PASS를 표시하지 않는다.

### 6.5 W12-06–W12-08: PageView 성공을 전체 완료로 확대하지 않는다

가변 높이 텍스트 목록, custom grid delegate, 중첩 scroll·focus reveal, 편집 composition, Overlay·route 수명과 디자인 패키지를 차례로 연결한다. §4.9의 미조사 영역도 W12-08 종료 전까지 이식·승인 차이·명시적 미지원으로 판정한다.

선언 목록에서 지우거나 export를 숨겨 전체 호환율을 올리지 않는다. 지원하지 않는 API는 공개 지원표에 남기며, 필수 범위가 미지원이면 해당 제품 수락은 실패 또는 BLOCKED다. 버전·지원 범위 변경은 의도적으로 표시한다.

## 7. 원본 대조와 검증 계약

### 7.1 기대값은 원본에서 얻는다

동일 pin·동일 입력·동일 clock/환경으로 Dart 원본과 TS 이식을 실행한다. 기존 Flutter 테스트 중 해당 의미를 검사하는 소수를 우선 활용하고 출처·라이선스를 유지한다. oracle에 Nelyx 정책을 주입하거나 Nelyx 결과로 기대값을 다시 만들지 않는다.

ID·시간 표현처럼 언어·호스트 차이에 필요한 정규화만 사전에 정의한다. identity는 문자열 주소 비교 대신 안정적인 대응 관계로 비교한다. debug assertion과 release 계약을 섞지 않고, 유효 입력에서의 결과·순서와 각 모드의 오류를 구분한다.

| 검증 묶음 | 필수 관측 |
| --- | --- |
| 언어·값·callback | 수치/동등성·예외·collection·microtask의 의존 의미 |
| Widget·Element 수명 | build·의존 갱신·key 이동·deactivate/activate/dispose 순서와 실제 보관 객체 |
| layout·paint | constraints·size·offset·baseline·dry/intrinsic·parent data·훅 호출 순서 |
| 사용자 확장 | custom RenderObject·CustomPainter·delegate·physics·recognizer가 원본과 같이 실행되는지 |
| gesture | 원 hit path·arena 승패·slop·velocity·team·취소·다중 pointer·signal |
| PageView·목록 | offset/activity·정착·callback·실제 child 생성/회수·cache/KeepAlive·resize |
| 편집·Focus | selection/composing·formatter·undo·키/Focus·reveal·IME 경계와 취소 |
| semantics | merge·sort·identifier·geometry·custom action·focus·세대와 OS 전달 |
| engine·자원 | 보유 프레임의 자원 생존·해제·취소·복구·shutdown·메모리 예산 |
| 실제 시각·입력 | 같은 font·locale·DPR·환경에서 화면·트랙패드·키보드·reader 확인 |
| 공급·재생성 | source/overlay·managed output·package·App·runner가 같은 선택 경로를 쓰는지 |

float 비교는 원본 테스트의 tolerance와 필요한 연산 차이를 먼저 정한다. 결과가 나쁘다고 허용 오차를 넓히지 않는다. 픽셀 차이는 font·backend·색 공간을 먼저 맞추고, 불가피한 차이의 범위·이유를 명시한다. 픽셀이 같아도 수명·입력·접근성이 다르면 충실도 PASS가 아니다.

### 7.2 기존 검사와 실행 비용

[child reconciliation](Nelyx/eng/check-child-reconciliation.mjs), [LayoutBuilder scheduling](Nelyx/eng/check-layout-builder-scheduling.mjs), [native gestures](Nelyx/eng/check-native-gestures.mjs), [날짜 Web 검사](Nelyx/eng/check-date-scroll-web.mjs) 같은 기존 검사는 파일이 존재한다. 실행 전 현재 계약·의존성·정리 동작을 확인하고 필요한 것만 재사용한다. 존재한다는 이유로 현재 실행 가능하거나 원본 동등성을 이미 입증했다고 간주하지 않는다.

기존 독자 native 정책을 기대값으로 삼는 검사는 그 정책의 과거 회귀 검사일 뿐이다. 안전성·자원·입력 invariant는 유지하되, 충돌하는 기대값은 원본 oracle 기준으로 교체하거나 해당 구현과 함께 퇴역시킨다.

모든 테스트·oracle·UI 검증 runner는 **20분, 1,200,000ms timeout**을 설정한다. 초과는 실패로 처리하고 자식 프로세스·브라우저·임시 디렉터리를 정리한다. 실패 실행을 계속 누적하거나 수백 번 반복하지 않는다. 일반 대조는 30회 이내의 판별 가능한 사례로 설계하고, 초과가 필요하면 목적과 범위를 먼저 정한다. 의미가 다른 필수 사례를 반복 횟수 제한 때문에 생략한다는 뜻은 아니다.

제품 코드 변경 시 [루트 scripts](package.json)의 타입·린트·포맷 검사와 영향 범위의 가장 작은 검사부터 실행한다. Source·native·ABI·공급이 실제로 바뀐 범위에만 재생성·빌드·App 공급 검사를 확대한다. 누락된 패키지·도구의 실패나 manifest 변경 없이 의존성을 다시 설치하지 않는다.

### 7.3 성능 판정은 원본 동등성 뒤에 별도로 한다

[W11 보관 요약의 성능 기준](history/26/11/14/work11-summary.md#성능-기준과-미수락)은 비교 기준으로 유지한다. 기존 60Hz 목표는 이동 게시 지연 p95 약 33.3ms 이하·최대 약 66.7ms 이하, 진행해야 하는 활성 구간에서 offset 무진행 100ms 이상 0회다. 이는 이번에 측정한 결과가 아니다.

cold 첫 생성, warm 이동, 이미 본 항목의 재진입, 일반 위젯 갱신과 resize를 분리한다. 같은 앱·입력·font·locale·DPR·지원 정책에서 CPU·GC/할당·메모리·실제 offset·게시 지연을 측정한다. resident 범위 확대·입력 감속·callback/semantics 생략·placeholder로 조건을 바꾸지 않는다.

Source 실행으로 native 독립 스크롤의 특성이 달라질 수 있다. 이를 숨기지 않으며, 원본 충실도 PASS를 성능 PASS로 올리지 않는다. 성능이 미달이면 **충실도 PASS / 성능 FAIL**로 남기고 의미를 보존하는 최적화를 조사한다. 충실도 유지와 제품 성능을 동시에 달성하지 못하면 제품 수락은 보류하고 요구의 재결정을 요청한다.

## 8. 공급 전환과 철거 원칙

### 8.1 전환 중에도 owner는 하나다

대조를 위한 임시 명시적 실행 선택은 가능하다. 그러나 한 View에서 원본과 native 경로를 섞어 state·geometry·gesture·semantics를 서로 다른 cohort에서 가져오지 않는다. 실패 시 자동 fallback하지 않고 실제 선택 경로와 오류를 드러낸다.

같은 Source API를 유지할 수 있는 범위는 import·사용자 callback·Key/State identity를 보존한다. 독립 v2 Widget 계층의 객체를 canonical State와 같은 것으로 강제 변환하지 않는다. 공개 API 변경이 필요하면 package version·이전 안내·runner/template 변경을 함께 처리한다.

### 8.2 삭제는 replacement 검증 뒤, 삭제 검증은 재생성 뒤

- PageView·scroll·gesture·editing 등 검증이 끝난 범위의 adapter 설치·등록·호출을 제거한다.
- 해당 C++ UI 정책·wire capability·metadata·generator injection의 다른 사용자를 확인한다. 공유 renderer·editor transport·자원 코드까지 통째로 삭제하지 않는다.
- 사용하지 않는 prototype whitelist·두 번째 Widget 모델·export·문서의 호환 주장을 정리한다.
- 관리 소스를 재생성하고 source·package·App을 다시 빌드해 삭제한 경로가 돌아오지 않는지 확인한다.
- 최종 runner 선택과 실제 runtime entry까지 검사한다. 파일명 변경이나 adapter 문자열 검색 0건만으로 종료하지 않는다.

### 8.3 임시 산출물을 누적하지 않는다

검증용 임시 디렉터리는 한 실행에 필요한 것만 만들고 성공·실패·중단 모두 finally에서 회수한다. raw 로그·immutable receipt·checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile을 누적 보관하지 않는다. 필요한 결론은 이 문서의 현재 상태와 기존 지원/소유권 자료에 간결하게 반영한다.

검증을 이유로 전체 SDK·package·cache를 매번 복제하지 않는다. 패키지 빌드는 현재 dist만 남기고 staging·이전 dist는 실행 종료 시 정리한다. 다른 드라이브에 보관 archive를 만들지 않는다. 기존 사용자의 수정·기록을 개편 과정에서 임의 삭제하지 않는다.

Android 번들링에서 IDE Oracle Java 서버가 해당 빌드의 project 디렉터리를 잠그는 경우에만 정확한 점유 PID를 확인해 종료하고, 그 실행의 명시적 출력 경로를 정리한다. 이름 기반 일괄 프로세스 종료나 광범위 디렉터리 삭제는 하지 않는다.

## 9. 완료 기준과 중단 기준

### 9.1 전체 완료에 필요한 조건

- [ ] 활성 Flutter pin·source identity와 선언별 현재 대응을 확정했다.
- [ ] 공개 API·옵션·확장점·runner별 전수 목록의 미조사 항목이 없다.
- [ ] 위젯·render·gesture·scroll·편집·semantics의 canonical 의미 owner가 하나다.
- [ ] PageView와 일반 목록·grid·텍스트 편집을 원본 경로에서 실행한다.
- [ ] 사용자 정의 RenderObject·Painter·delegate·physics·recognizer가 per-widget native 등록 없이 지원 범위 안에서 동작한다.
- [ ] 원본 대조, 재생성, 제품 공급의 선택 경로를 각각 확인했다.
- [ ] 독자 대체 경로·생성 주입·잘못된 canonical export와 문구를 철거했다.
- [ ] 승인된 제품 정책과 미지원 API를 원본 기본 동작과 구별해 공개했다.
- [ ] Windows·Web·Android 및 나머지 목표 플랫폼의 실제 확인/미확인 범위를 나눠 기록했다.
- [ ] 기능·시각·물리 입력·IME/reader·성능·자원 수명을 서로 다른 결과로 수락했다.

충실한 이식의 완료와 Flutter 전체 API 지원 완료는 다르다. 지원 범위를 명시적으로 좁힌다고 전체 호환으로 표시하지 않는다. 현재 Apple·Linux 등의 미검증 의무도 Windows 또는 Web 성공에 포함시키지 않는다.

### 9.2 다음 경우에는 확대하지 않는다

- 원본 pin·oracle identity 또는 실제 runtime 선택이 불명확하다.
- API 모양·픽셀·내부 native 검사만 맞고 원본 lifecycle·callback 순서가 다르다.
- 지원하려면 다시 위젯별 native 예외나 다른 State/Element 모델을 추가해야 한다.
- 임의 builder·physics·painter를 생략해야만 성능을 통과한다.
- 기존 자원·세대·오류 검사를 약화해야 새 경로가 실행된다.
- 한 세로 단면만 끝났는데 전체 framework/제품 완료로 확대하려 한다.

막힌 항목은 실제 증거와 함께 BLOCKED/PARTIAL로 남긴다. Flutter/Dart로의 제품 전환이나 TypeScript 요구 변경은 별도 사용자 결정 사항이며, 구현자가 성능을 이유로 임의 변경하지 않는다.

## 10. 이번 문서의 결론과 실행 시작점

확인한 핵심 문제는 C++ 사용 여부가 아니라 **Flutter 원본 프레임워크와 별도 native 정책이 같은 위젯의 의미를 나누어 소유하는 구조**다. 해결 방향은 native 위젯을 더 많이 만드는 것이 아니라, 원본 기반 Source 실행을 단일 기준으로 복원하고 엔진 연결을 drawing·resource·platform 경계로 내리는 것이다.

첫 작업은 W12-00의 활성 원본·실행 경로 전수 목록이다. 그 결과를 바탕으로 W12-01/W12-02를 진행하고, 기존 FrameworkRoot를 활용한 Source 기준선을 만든 뒤 PageView를 첫 제품 세로 단면으로 교체한다. 이후 다른 위젯·입력·디자인 패키지까지 같은 기준으로 확대한다.

현재 완료된 것은 **대표 경로의 정적 감사와 이 개편 계획 작성**이다. W12-00부터 W12-10까지의 제품 구현·원본 실행 대조·성능 수락은 아직 완료하지 않았다.
