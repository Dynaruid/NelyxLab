# Nelyx Core

[English](README.md) | **한국어**

`@nelyx/core`는 Nelyx의 플랫폼 독립 TypeScript UI 프레임워크입니다. Widget·Element·RenderObject 트리, 상태, 레이아웃, 페인트, 제스처와 앱 계약을 관리합니다. [SDK](sdk/README.ko.md)가 플랫폼을 연결하고 [Skia](skia/README.ko.md)가 렌더링을 제공합니다.

설치와 샘플 실행은 [프로젝트 가이드](../README.ko.md)에서 시작하세요.

## 실험용 v2 엔진 protocol

`@nelyx/core/v2`는 C++ 엔진의 packet codec·명령·`EngineClient`·`createWasmTransport`를 제공합니다. 원본 계약은 [engine/schema/protocol.json](engine/schema/protocol.json)이며 저장소 루트의 `node Nelyx/engine/tools/generate-schema.mjs --check`로 C++/TS 생성본 일치를 검사합니다. `npm.cmd run build:core`가 기존 Core export와 이 subpath를 함께 빌드합니다.

저장소 루트에서 `npm.cmd run test:engine-v2`로 Windows x64와 두 Node-hosted Wasm profile의 공통 계약을 컴파일·실행합니다. `npm.cmd run build:engine-v2`는 현재 headless native library/driver와 별도 `single-worker`/`threaded` 공급만 `Nelyx/engine/dist`에 남깁니다. Wasm에는 활성화한 [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) **4.0.22**가 필요하며 `EMSDK` 또는 사용자 cache의 `.cache/tooling/emsdk`에서 찾습니다. 검사는 20분 timeout과 임시 빌드 finally 정리를 사용하고, 공급 빌드도 staging·이전 dist를 제거합니다.

이 진입점에는 v2 packet port가 필요하며 현재 일반 runner의 v2 Widget renderer는 미완료입니다. Windows host·browser surface·공식 CanvasKit adapter·Content/Render owner bootstrap 소스를 작성하던 중 사용자 요청으로 **PAUSED / PARTIAL** 상태로 중단했습니다. Host compile/link·browser bundle/asset 공급·실제 화면과 독립 실행은 아직 미검증입니다. 공급 builder는 여전히 headless 전용(`contentIndependent=false`)입니다. 이전 schema의 engine dist가 남아 있으므로 현재 Core와 함께 사용하지 말고 재개 시 소스에서 다시 빌드해야 합니다. [work8-1 중간 마무리](../work8-1.md#중간-마무리--사용자-외출로-명시-중단)의 재개 절차를 따릅니다. 표준 layout·전체 gesture·실제 browser 배포는 미완료입니다.

Client는 승인 document와 scene 활성화를 구별합니다. ACK timeout 뒤에는 보관한 bytes의 `queryCommitResult()` 또는 `retryCommit()`을 사용하며 이미 승인된 변경을 취소한 것으로 간주하지 않습니다. Provider frame hold가 남으면 close는 `busy`를 반환하므로 host가 먼저 회수해야 합니다. `reservedBytes`는 내부 reservation이며 process RSS나 아직 연결하지 않은 GPU/provider heap이 아닙니다.

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
