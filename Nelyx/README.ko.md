# Nelyx Core

[English](README.md) | **한국어**

`@nelyx/core`는 Nelyx의 플랫폼 독립 TypeScript UI 프레임워크입니다. Widget·Element·RenderObject 트리, 상태, 레이아웃, 페인트, 제스처와 앱 계약을 관리합니다. [SDK](sdk/README.ko.md)가 플랫폼을 연결하고 [Skia](skia/README.ko.md)가 렌더링을 제공합니다.

설치와 샘플 실행은 [프로젝트 가이드](../README.ko.md)에서 시작하세요.

## 실험용 v2 엔진 protocol

`@nelyx/core/v2`는 C++ 엔진의 packet codec·명령·`EngineClient`·`createWasmTransport`를 제공합니다. 원본 계약은 [engine/schema/protocol.json](engine/schema/protocol.json)이며 저장소 루트의 `node Nelyx/engine/tools/generate-schema.mjs --check`로 C++/TS 생성본 일치를 검사합니다. `npm.cmd run build:core`가 기존 Core export와 이 subpath를 함께 빌드합니다.

저장소 루트에서 `npm.cmd run build:engine-v2`를 실행합니다. 공개 Core/Material/Cupertino/SDK를 먼저 빌드하고 HWND/Hermes/Skia host, 두 engine Wasm profile, worker/App bundle, 수정하지 않은 공식 CanvasKit **0.41.0/full** 자산을 현재 `Nelyx/engine/dist`에 공급합니다. Wasm에는 [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) **4.0.22**가 필요하며 `EMSDK` 또는 사용자 cache의 `.cache/tooling/emsdk`에서 찾습니다. Windows는 고정된 local Skia/Hermes 공급을 사용하고 누락·불일치를 거부합니다. 교체 후 staging·이전 출력을 제거합니다.

- Windows: `npm.cmd run run:engine-v2:windows`. Wheel 또는 왼쪽 pointer drag로 스크롤하고 `Ctrl+U`로 App 선언을 갱신합니다. 창을 닫으면 provider를 drain하고 owner를 join합니다.
- Web: `npm.cmd run run:engine-v2:web` 후 `http://127.0.0.1:8192/isolated/`에서 threaded 자동 선택, `/plain/`에서 비격리 single-worker 자동 선택을 확인합니다. `?profile=threaded`는 격리가 필요하며 명시 요구·자산/ABI 오류는 TS renderer 전환 없이 실패합니다. 정적 배포는 현재 dist 전체와 격리 route의 worker/asset에 일관된 COOP/COEP headers를 제공해야 합니다.
- 검사: `npm.cmd run test:engine-v2`(공통 계약 162개), `npm.cmd run test:engine-v2:actors`(owner 일정·caret deadline·provider 실패 복구), `npm.cmd run test:engine-v2:glyphs`(padding 포함 픽셀 25 corpus·UTF-16·편집 geometry), 공급 빌드 후 `npm.cmd run test:engine-v2:hosts`(통합 5개, 실제 UIA/DOM 편집·버튼 포함). 검사는 20분 timeout과 임시 출력 finally 정리를 사용합니다.

Windows/threaded Web은 독립 Content/Render owner를 연결합니다. Single-worker는 협력 실행이며 `contentIndependent=false`입니다. Testbed는 v2 Widget/State/Key로 선언하고 C++ layout·intrinsic/dry query·편집 document·semantics를 사용합니다. Arabic/Hebrew fallback·color emoji를 공급합니다. 전체 Widget/Material/Cupertino API·gesture·Android는 **PARTIAL**이며 실제 IME/reader·trackpad/FPS 수락은 별도입니다. [구현과 잔여 범위](../work8-2.md#이번-작업의-구현검증-현황)를 참고하세요.

Client는 승인 document와 scene 활성화를 구별합니다. ACK timeout 뒤에는 보관한 bytes의 `queryCommitResult()` 또는 `retryCommit()`을 사용하며 이미 승인된 변경을 취소한 것으로 간주하지 않습니다. Provider frame hold가 남으면 close는 `busy`를 반환하므로 host가 먼저 회수해야 합니다. `reservedBytes`는 내부 reservation이며 process RSS나 별도 GPU/provider heap의 합계가 아닙니다.


`commands.layout(node, options)`로 C++ layout을 선택합니다. Box 계열·Flex·Stack·Wrap·Grid·ScrollViewport primitive의 자식 layout을 C++가 수행합니다. `direction`, `mainSize`, `mainAlign`, `crossAlign`, `flex`/`fit`, `gap`/`runGap`, `columns`, 각 변의 `padding`을 지정합니다. 양수 width/height는 부모 제약 안의 선호 크기이며 0은 자연 크기입니다. 명시적인 빈 박스는 tight zero 제약을 사용하세요. Unbounded expand·미지원 정렬/layout 조합은 명시적으로 실패합니다.

Text/Image/EditableText에도 같은 계약의 padding을 지정할 수 있습니다. Node snapshot의 `content` rect는 border box 내부의 paint 영역이며 baseline·편집 geometry에도 padding을 반영합니다. Wrap/Grid stretch는 run별 자식 재측정을 사용하고 수평 baseline을 지원합니다. Grid `mainAlign`은 세로 행 배분, `mainSize: 'max'`는 유한 높이 확장, `crossAlign`은 행 안의 자식 정렬입니다. Box/Stack은 start/center/end·cross stretch/baseline·유한 주축 확장을 지원합니다. V2 primitive의 계약이며 Flutter 전체 API 호환을 뜻하지 않습니다.

`view.dryLayout(node, horizontal, vertical)`와 `view.intrinsic(node, 'minWidth'|'maxWidth'|'minHeight'|'maxHeight', oppositeExtent)`는 Content에서 비동기로 계산하며 document/metrics/font를 결과에 포함합니다. Dry는 실제 layout continuation을 사용하고 활성 scene을 바꾸지 않습니다. View당 query 1개이며 취소·timeout·metrics/font/device 변경을 검사합니다. 크기를 결정할 수 없는 viewport/sliver intrinsic과 expand query는 지원하지 않습니다.

같은 v2 subpath의 `WidgetHost`, `StatelessWidget`, `StatefulWidget`, `State`, `InheritedWidget`, `ValueKey`, `GlobalKey`와 `Box`, `Row`, `Column`, `Stack`, `Wrap`, `Grid`, `ScrollView`, `Text`, `Image`, `EditableText`, `Button`, `Semantics`로 장면을 선언합니다. `mount`/`update`/`flush`는 ACK 기준으로 diff하고 Key 재부모화·상태·NACK/ACK 유실을 처리합니다. 표준 자식 layout은 C++에 남습니다. 기존 v1 Widget import를 이 경로에 자동 연결하지 않습니다.

GlobalKey 재부모화는 `deactivate`/`activate`와 의존성 갱신을 수행합니다. 초기화·갱신 lifecycle에서 build 전에 `setState`를 호출할 수 있습니다. Build 실패는 Element 정보·미전송 할당을 복구하며 앱의 임의 부수 효과까지 되돌리지 않습니다. Hook이 예외를 던져도 dispose는 terminal입니다. `WidgetHost.close()`는 모든 State와 native view를 정리한 뒤 hook 오류를 `AggregateError`로 반환합니다. Focus된 collapsed caret는 C++의 500 ms deadline으로 깜박이고 조합 중에는 고정 표시, selection/blur에서는 정지합니다. 게시 frame의 `caretVisible`로 표시 상태를 구별하며 Widget/paragraph를 다시 만들지 않습니다.

`EditingController('초깃값')`를 `EditableText`에 부착한 뒤 `refresh()`로 revision을 받고 `edit({kind:'replace',revision,text,base,extent,policy})`로 조건부 수정합니다. Text/selection/composing은 Core가 보유하고 undo/redo를 제공합니다. 같은 handle의 초깃값을 바꾸지 말고 편집 명령을 사용하세요. OS/browser composing 종료 전 App replacement는 거부될 수 있습니다. `semanticsSnapshot()`은 게시 world geometry와 최신 비시각 편집 값을 구별하며, `focus()`/`semanticAction()`은 게시 ID·focus session·node 세대를 검사합니다. Windows는 TSF/UIA, Web은 `dom-textarea/aria`를 연결합니다. 실제 IME 후보창·전체 keyboard/clipboard/reader 조합은 미검증입니다.

`new ListView({generation: 1n, itemCount: 2000, estimatedExtent: 48, itemKey: i => i, itemBuilder: i => new Box([], {properties: {height: 48}})}, {properties: {width: 300, height: 400}})`로 필요한 세로 구간만 생성합니다. 데이터/순서 변경 때 `generation`을 올리고 재배치 때 `findChildIndex`를 제공합니다. C++ 실측 extent·활성화 시점의 key anchor 교정은 준비 중 들어온 입력도 보존합니다. `cacheItems`는 focus/명시 keep-alive를 포함해 8–128개(기본 96)입니다. Async builder는 `placeholder`가 필요하며 동시 4개·2초 timeout으로 제한됩니다. `ListBuildSignal`을 받고 Web fetch에는 `nativeSignal`을 사용할 수 있습니다. Eviction/generation/dispose는 abort하며 늦은 결과를 버립니다. 수평 list·먼 index seek·전체 provider/GPU 메모리 합산은 남습니다.

이 Core Widget에는 명시적인 `@nelyx/material/v2`, `@nelyx/cupertino/v2`를 사용합니다. 지원 생성자의 button·selection control·slider/progress·editor·surface가 native 상태/paint를 선언합니다. Testbed는 두 패키지와 2,000행 목록을 실행합니다. `NavigatorController`/`Navigator`는 최대 32 route 보존·modal barrier를 제공합니다. 기존 v1 디자인 패키지보다 작은 API이며 전체 form 검증·테마/아이콘/전환·일반 SDK resolver 이식은 남습니다.

`new GestureDetector(child, protocol.gestures.tap | protocol.gestures.longPress, callback)`로 C++ recognizer를 선언합니다. Tap/double tap/long press·축 pan·2-contact pinch·hover·scrollbar drag, control pressed/hover/value·slider step·keyboard activation은 App callback 응답을 기다리지 않습니다. Pinch는 결과 event를 보내며 임의 content zoom transform·전체 gesture arena·raw observer/appControlled·모든 physics는 미구현입니다.

Editor의 명시적인 `commit`/`cancel` replacement는 host의 실제 composition-end 확인을 기다립니다. Native busy 재시도는 같은 ID/bytes를 사용하고 Web은 DOM 입력 큐 밖에서 종료를 기다립니다. 확인이 없으면 제한 시간 내 실패 결과를 냅니다. Windows는 보유 paragraph의 grapheme/word/line geometry로 이동·삭제하며 v2는 명시적으로 최대 65,536 UTF-16-unit query 예산을 사용합니다. 모든 bidi affinity·자동 reveal/내부 scroll·EditContext character bounds·물리 IME/clipboard/reader 수락은 남습니다.

`await view.layoutSnapshot()`은 마지막 활성화 layout을 반환합니다. Node 좌표·baseline은 부모 기준이며 `layoutDocument/layoutMetrics`가 해당 geometry의 버전입니다. 새 document 승인이나 host metrics 변경만으로 좌표의 버전을 바꾸지 않습니다. `commands.text(node, value, size, color, {direction: 'rtl'})`로 RTL을 지정합니다. Web 공급 font의 hash를 manifest와 대조하고 worker 사이 glyph run에도 font identity를 유지합니다.

`commands.coverage(scrollNode, revision, {minimum, maximum})`는 논리 extent와 별개로 준비된 **visual offset** 범위를 선언합니다. `NeedChildren`을 coverage revision별로 합칩니다. 활성 engine-driven gesture만 한 viewport 이내의 최신 목표 하나를 보관하고 반전/end/cancel/hide에서 버립니다. Phase 없는 wheel은 지연 목표를 누적하지 않습니다. 추종 속도는 min(2,400 px/s, 4 viewport/s), tick당 최대 적용 시간은 1/60초입니다. 준비 밖 programmatic 목적지는 `contentUnavailable`로 끝납니다. `ListView`는 실제 builder와 native anchor 교정을 연결합니다.

## 모듈

API는 명시적인 하위 경로에서 import합니다. Core는 패키지 루트의 통합 API를 제공하지 않습니다.

| 영역 | 책임 | Import 예 |
| --- | --- | --- |
| [Foundation](src/foundation/) | 알림, 자원 해제, 시계, 오류와 공통 도구 | `@nelyx/core/foundation/notifier` |
| [UI](src/ui/) | Canvas, 좌표, 텍스트, 이미지와 프레임 계약 | `@nelyx/core/ui/canvas` |
| [Hosting](src/hosting/) | 앱, View, 자원과 서비스 수명 | `@nelyx/core/hosting/runtime` |
| [Framework](src/framework/) | 위젯, 렌더링, 스케줄링, 제스처, 애니메이션과 내비게이션 | `@nelyx/core/framework/widgets/basic` |
| [Services](src/services/) | 편집, 플랫폼 채널, 키보드와 OS 서비스 계약 | `@nelyx/core/services/text-editing` |

공개 하위 경로는 [package.json](package.json)에 있습니다. Core는 React Native나 OS API에 의존하지 않습니다.

## Widget 앱

```ts
import {widgetApplication} from '@nelyx/core/framework/widgets/root';
import {Column, Padding, Text} from '@nelyx/core/framework/widgets/basic';
import {allInsets} from '@nelyx/core/ui/geometry';

export function main() {
  return {
    definition: widgetApplication({
      id: 'hello',
      createRoot: () => new Padding(
        allInsets(24),
        new Column([
          new Text('Hello Nelyx', {fontId: 'app-font', fontSize: 24}),
        ]),
      ),
    }),
  };
}
```

앱의 `package.json` → `nelyx.assets`에 `app-font`를 선언하고 `main().definition`을 플랫폼의 `ApplicationSurface`에 전달합니다. 전체 연결 예는 [Web runner](../sample/nelyx-testbed-app-2/web/runner/App.tsx)에 있습니다.

각 View는 BuildOwner, PipelineOwner, scheduler, focus와 마운트된 State를 소유합니다. 지역 상태에는 `framework/widgets/framework`의 `StatefulWidget`·`State.setState`를, 자식 이동 중 식별 유지에는 key를 사용합니다. `createRoot(context, scheduler)`는 View 서비스와 호스트 프레임 스케줄러를 받습니다.

## 디자인 패키지 import

| UI 계층 | Import |
| --- | --- |
| 공통 위젯 | `@nelyx/core/framework/widgets/basic` |
| Material 3 | `@nelyx/material/widgets` |
| Cupertino | `@nelyx/cupertino/widgets` |

[Material](../packages/material/README.md)·[Cupertino](../packages/cupertino/README.md)가 각 컴포넌트와 정식 테마를 소유합니다. Core의 `framework/widgets/app-data`에 있는 `AppTheme`·`AppThemeData`는 공통 Nelyx 테마 어댑터입니다. 세 패키지는 하나의 Core 인스턴스를 공유합니다.

## 프레임워크 사용

| 작업 | 모듈 |
| --- | --- |
| 레이아웃과 제약 | `framework/widgets/basic`, `framework/rendering/constraints` |
| 텍스트 편집 | `framework/widgets/editable-text` |
| 목록과 스크롤 | `framework/widgets/scroll`, `framework/widgets/scroll-view` |
| 화면 전환과 내비게이션 | `framework/widgets/navigation` |
| Focus와 키보드 action | `framework/widgets/focus-scope`, `framework/widgets/shortcuts` |
| 그리기 | `ui/canvas`, `ui/paint`, `framework/widgets/custom-paint` |
| 이미지와 장식 | `framework/widgets/image`, `framework/painting/box-decoration` |

앱에서 전달한 controller, FocusNode, 이미지 등의 자원은 각 소유자의 수명을 따릅니다. 소유자가 끝날 때 해제하세요. TextEditingController는 하나의 마운트된 EditableText에 연결하며, OS 조합 입력과 선택 영역은 SDK 편집 서비스를 통해 조율합니다.

사용자 정의 render object는 [framework/rendering/](src/framework/rendering/)의 layout·paint·hit test·무효화 계약을 사용합니다. 그리기는 `paint`에서 수행하고, render object를 통해 layout이나 paint를 무효화하며, 해제 시 소유 자원을 정리합니다.

요청한 프레임은 paint를 수행하고 renderer에 제출합니다. renderer의 `accepted`는 native 작업의 수락이며 화면 표시 완료가 아닙니다. 같은 geometry·paint version이나 이전 수락만으로 후속 redraw·애니메이션·스크롤 프레임을 생략하지 않습니다. 기존 repaint boundary와 layer 내부의 자원 재사용은 유지합니다.

낮은 수준의 scene 소비자가 사용하는 `FrameworkRoot.build(scene)`은 `FrameRecording`을 반환합니다. `shouldSubmitFrame()`의 첫 프레임 지연 같은 owner 조건을 확인하고, renderer가 제출을 받아들인 뒤 `frameSubmitted(token)`을 호출하세요. 캡처·해제 계약은 [ui/frame.ts](src/ui/frame.ts)에 있으며, recording과 제출된 GPU 작업의 자원 수명은 별도로 관리합니다.

## 빌드와 확인

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run build:core
npm run check --workspace @nelyx/core
```

전체 패키지 빌드는 `npm run build:sdk`를 사용합니다. 로컬 archive로 소비할 때는 변경 후 runner에 다시 공급하고 설치하세요. [CLI 가이드](sdk/tooling/cli/README.ko.md#공급과-설치)에 절차가 있습니다.

Nelyx는 Flutter API의 일부를 구현합니다. 사용할 수 있는 기능은 모듈 선언과 [Testbed](../sample/nelyx-testbed-app-2/README.ko.md)를, 플랫폼 준비 수준은 [프로젝트 가이드](../README.ko.md#프로젝트-상태)를 참고하세요.

## 라이선스

Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 가져온 코드와 자산의 고지는 [licenses/](licenses/)에, 소스 pin과 소유권 메타데이터는 [upstream/](upstream/)에 유지합니다.
