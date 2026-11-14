# Nelyx Core

[English](README.md) | **한국어**

소비자 프로젝트는 **TypeScript >=7.0.0**을 사용하며 생성 runner는 **7.0.2**로 고정합니다. Runner 검사는 설치된 compiler의 공개 package metadata와 실제 실행 버전을 확인합니다. 생성 설정은 폐지된 `baseUrl` 없이 상대 paths와 명시한 app root를 사용합니다.

Workspace의 `tsc`는 `@typescript/native` alias의 native TypeScript 7.0.2를 사용합니다. Shader/declaration AST 변환과 원래 API inventory는 Microsoft TypeScript 6 호환 API를 유지합니다. 패키지 빌드는 호환 API emit 전에 native 7.x 프로젝트 검사를 통과해야 합니다. [Microsoft API 전환 안내](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)를 참고하세요.

`@nelyx/core`는 Nelyx의 플랫폼 독립 TypeScript UI 프레임워크입니다. Widget·Element·RenderObject 트리, 상태, 레이아웃, 페인트, 제스처와 앱 계약을 관리합니다. [SDK](sdk/README.ko.md)가 플랫폼을 연결하고 [Skia](skia/README.ko.md)가 렌더링을 제공합니다.

설치와 샘플 실행은 [프로젝트 가이드](../README.ko.md)에서 시작하세요.

## Source 프레임워크와 단절적 변경

Core 0.17.0은 FrameworkRoot의 Source Widget/Element/RenderObject 트리 하나를 실행합니다. Source pipeline이 build·layout·compositing bits·paint·hit test·gesture·semantics를 결정하고, backend는 drawing·텍스트/이미지 자원·플랫폼 transport를 공급합니다. 사용자 render/painter/recognizer 훅은 native 위젯 등록 없이 Source에서 실행합니다.

native 설정 전용 Widget host·interception 등록부·별도 v2 Widget/State 모델과 관련 export는 삭제했습니다. canonical framework import와 @nelyx/sdk/app의 Source 앱 정의를 사용합니다. deprecated alias나 자동 renderer 대체 경로는 제공하지 않습니다. PageScrollPhysics의 viewportFraction 옵션은 삭제하고 PageController가 해당 값을 소유합니다. PageController.page는 PageView 하나가 attach된 상태에서 읽습니다. PageView.builder는 선택적 itemCount·findChildIndexCallback을, PageView.custom은 Source child delegate를 받습니다.

활성 Flutter pin은 71e4717a61786faab4c7aa39825989305ed29e8a입니다. [현재 구현과 수락 범위](../work12.md#11-현재-구현과-확인-범위)에서 Source 내부 검사·Dart 원본 대조·실제 플랫폼/시각/입력/성능 결과를 구분합니다. Flutter 전체 API 또는 모든 플랫폼 동등성을 완료했다고 표시하지 않습니다.

이전 packet Scene/control frontend와 engine export는 제거했습니다. Source backend가 사용하는 Vulkan·Paragraph·IME·접근성 helper만 엔진 자원으로 유지합니다.

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
