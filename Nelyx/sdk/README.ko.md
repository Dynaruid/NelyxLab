# Nelyx SDK

[English](README.md) | **한국어**

소비자 프로젝트는 **TypeScript >=7.0.0**을 사용하며 생성 runner는 **7.0.2**로 고정합니다. Runner 검사는 설치된 compiler의 공개 package metadata와 실제 실행 버전을 확인합니다. 생성 설정은 폐지된 `baseUrl` 없이 상대 paths와 명시한 app root를 사용합니다.

`@nelyx/sdk`는 [Core 프레임워크](../README.ko.md)를 플랫폼 앱, 렌더링 표면, 입력, 자산, OS 서비스와 호스트 수명에 연결합니다. 공통 앱 코드는 `src/`에 두고 각 플랫폼 runner가 등록 코드와 빌드 설정을 제공합니다.

전체 앱 예는 [Testbed 가이드](../../sample/nelyx-testbed-app-2/README.ko.md), 새 앱 생성은 [CLI](tooling/cli/README.ko.md)를 참고하세요.

## 실험용 v2 packet port

`@nelyx/sdk/engine-v2`는 `connectEngineV2Host(host, options)`를 제공합니다. v2 packet transport와 `engine: 'v2'`·`abiMajor`·`schema`를 가진 `identity`를 전달합니다. Facade의 bundle/host 검사 뒤 C++ handshake가 요청한 capability를 검사합니다. 빌드 명령·ACK 재시도·활성화·close/drain은 [Core v2 안내](../README.ko.md#실험용-v2-엔진-protocol)를 참고하세요.

`createBrowserEngineV2Surface(canvas, { root: new URL('/engine/', location.href), profile: 'auto' })`로 공급된 worker runtime을 새 canvas에 연결합니다. 현재 engine dist 전체를 `root`에서 제공해야 합니다. 반환 surface는 packet host·App port·진단·비동기 `close()`를 제공합니다. Main은 bounded input/viewport를 전달하고 C++가 scene 좌표·scroll·hit-test를 소유합니다. `auto`는 격리/shared memory가 있으면 threaded, 없으면 single-worker를 선택합니다. 명시 capability 누락·공급 오류는 v1 fallback 없이 시작 실패로 처리합니다. Close는 provider/worker를 drain하며 다음 session은 새 canvas가 필요합니다. App worker를 `surface.createAppPort(appWorker)`에 전달해 surface에 종료 소유권을 등록하세요. 일반 launcher는 이를 자동 수행합니다. Surface는 등록한 App worker를 종료한 뒤 host 예약을 반환합니다. Worker가 등록되지 않은 port는 동기 paragraph service를 요청할 수 없습니다.

브라우저를 숨기면 준비 결과 cache를 비우고 GPU cache 한도를 줄입니다. 별도 embedder가 메모리 압력 신호를 받으면 `surface.setMemoryPressure(true)`를 호출하고 해제 시 `false`를 전달할 수 있습니다. 이 호출은 요청이며 `diagnostics['memory-pressure']`가 실제 owner 적용 결과를 보고합니다. 현재 게시는 계속 사용할 수 있고 압력 중에도 필요한 새 장면을 준비합니다. Windows host는 OS의 low-memory resource notification을 직접 관측합니다. Cache 축소를 Wasm heap·진행 중인 GPU 작업·driver 메모리의 즉시 반환으로 해석하지 않습니다.

자체 Windows host와 두 Web profile에서 v2 Widget/State/Key·C++ layout/intrinsic/dry query·편집 document·semantics를 사용하는 Testbed를 실행합니다. Web surface는 `dom-textarea/aria` 입력 carrier와 게시 geometry 기반 peer를 만들고 App의 edit/focus/action도 같은 Main 큐에서 순서대로 처리합니다. App port는 24 request/3 MiB까지 사용하고 전체 32 request/4 MiB 중 나머지를 Main 입력에 예약합니다. Windows는 STA UI owner의 실제 TSF context·UIA Fragment/Value/Text/Invoke를 연결합니다. 빌드/실행과 API는 [Core 안내](../README.ko.md#실험용-v2-엔진-protocol)를 참고하세요. 전체 Widget/Material/Cupertino·gesture·Android 이식과 물리 IME/reader·성능은 PARTIAL입니다. [work8 실행 기록](../../history/26/11/04/work8-2-summary.md#이번-작업의-구현검증-현황)에 당시 검증 경계를 보존하고, [work9.md](../../work9.md)에서 잔여 작업과 새 host 계획을 관리합니다.

### 일반 v2 프로젝트

Windows App SDK 후보를 선택하려면 `nelyx.v2.json`에 `"windowsHost": "windows-app-sdk"`를 추가한 뒤 Windows build/run/pack을 수행합니다. 현재 공급의 `windows-app-sdk` profile이 필요하며, 실제 AppWindow·Microsoft.UI dispatcher와 기존 Graphite/Vulkan renderer를 사용합니다. 실행 프로젝트는 고정 `Microsoft.WindowsAppSDK@1.8.260508005`의 unpackaged/self-contained 배포를 만들고 App SDK DLL·MSVC CRT·license를 함께 제공합니다. 필수 runtime이나 공급 identity가 없으면 시작 검사를 거부합니다. 기존 기본값은 `windows-hwnd`이며, 새 후보의 전체 API·물리 입력·성능 수락은 [work9](../../work9.md)에서 별도로 관리합니다.

저장소 Testbed는 `npm.cmd run build:engine-v2` 후 `npm.cmd run run:engine-v2:windows-app-sdk`로 실행합니다. `V2_WINDOWS_HOST`는 실제 host/dispatcher 경로를, `V2_INPUT_SOURCE`는 DirectManipulation 입력의 admission/rejection 수를 보고합니다. 주입 wheel·자동 UIA 검사로 물리 precision trackpad 사용감을 승인하지 않습니다.

일반 v2 공급 빌드는 준비된 `m153-nelyx-paragraph.5` CanvasKit의 manifest·파일 hash·paragraph API 1·글꼴 참조 Picture API 2·불변 font collection API 1을 검사합니다. 준비물이 없거나 다르면 빌드를 거부합니다. [Owned runtime 준비 안내](../skia/eng/source-build/README.md)를 따르세요. npm CanvasKit은 타입 선언에 사용하며 앱 실행 중 vendor 다운로드/빌드를 시작하지 않습니다.

서로 맞는 Core·SDK·CLI·Metro·Static AOT 패키지 archive로 일반 프로젝트를 만듭니다. 디자인 패키지를 사용할 때는 해당 archive와 `--designs material,cupertino`를 추가합니다. App 루트에서 한 번 설치합니다.

```powershell
nelyx create MyApp --engine v2 --packages <archive-directory>
npm.cmd --prefix MyApp install --workspaces=false
cd MyApp
npx --no-install nelyx build --engine v2 --target web --engine-inputs <current-engine-dist>
npx --no-install nelyx run --engine v2 --target web --port 8192
```

`nelyx.v2.json`에 `schema: "nelyx.app.v2/1"`·`engine: "v2"`·상대 경로 `entry`와 논리 이름→상대 파일 경로의 `assets` map을 선언합니다. 선택 사항인 `supply`는 engine 디렉터리이며 `--engine-inputs`가 우선합니다. Entry에서 `defineEngineV2App({build, ready, dispose})`를 default export합니다. `build(context)`는 v2 Widget을 반환하고 `context.asset(name)`을 기다릴 수 있으며, `context.view`는 버전이 있는 packet client입니다. `dispose` 다음에 Widget·provider·engine을 drain합니다.

중복 close 요청은 같은 결과를 공유합니다. 앞선 정리가 실패해도 App·Widget·transport·browser surface 정리를 모두 시도합니다. 오류 하나는 원래 객체를 유지하고, 여러 오류는 순서가 있는 `errors`·첫 `cause`·native/worker 보고에도 남는 메시지를 가진 `AggregateError`로 반환합니다. Host는 provider/Core를 drain한 뒤 실패한 close 결과를 반환합니다.

Windows는 App dispose를 최대 3초 기다리고 App owner에 250 ms 종료 유예를 줍니다. 평가한 JavaScript가 계속 실행되면 Hermes async break를 요청하고 owner를 join한 뒤 실패 session으로 drain합니다. JavaScript loop를 중단하는 경로이며 native/GPU consumer가 보유한 자원을 바로 해제하는 허가는 아닙니다.

기본 출력은 `dist/v2-web` 또는 `dist/v2-windows`입니다. `--target windows`는 선택한 자체 Hermes/Skia host를 사용합니다. `doctor`는 공급 검증, `prepare`는 App bundle 빌드를 수행합니다. `pack --engine v2 --target web`은 검증한 engine 공급을 포함한 `dist/v2-web-package`를 만듭니다. `run --engine v2 --target web --package dist/v2-web-package`로 이 package를 실행합니다. 서버의 `/isolated/`는 자동 threaded 선택, `/plain/`은 기능이 동작하는 single-worker profile입니다. Android·Apple·Linux v2 host는 아직 공급하지 않습니다.

`npx --no-install nelyx dev --engine v2 --target web --engine-inputs <current-engine-dist>`는 시작 시점부터 App 소스·설정·자산을 감시합니다. `--target windows`와 선택한 `windowsHost`, 사용자 지정 `--output`도 지원합니다. 새 bundle의 준비 실패는 기존 앱을 유지합니다. 준비가 성공하면 이전 App·provider·worker 또는 Windows VM/창을 drain한 뒤 새 session으로 교체합니다. App State는 초기화되며 상태 보존 hot reload는 제공하지 않습니다. 교체 중 dispose·owner 종료 실패는 해당 개발 실행을 실패로 끝냅니다.

개발 Web 서버는 loopback에서 최대 8개 연결을 사용하고 기존 client의 drain 응답을 최대 15초 기다립니다. 세대별 자원 URL은 현재 bundle과 직전 bundle 하나로 제한하며 만료 요청은 410으로 거부합니다. 새 bundle의 자원을 이전 session에 반환하지 않습니다. Ctrl+C로 감시·host/server와 임시 candidate·이전 bundle을 정리합니다.

빌드·실행은 Core/host ABI·protocol schema·공급 source identity와 선언한 모든 파일의 hash를 검사합니다. 자산 이름·파일 경로는 선언한 root 안으로 제한하고 App 자산 합계는 32 MiB입니다. 빌드 실패는 이전 bundle을 보존합니다. Package에는 현재 engine과 그 license·App이 포함되며 Testbed entry나 저장소 자산 조회가 필요하지 않습니다. 생성한 프로젝트는 고정 버전의 TypeScript compiler를 자체 dev dependency로 설치합니다.

Widget은 `@nelyx/core/v2`·`@nelyx/material/v2`·`@nelyx/cupertino/v2`에서 import합니다. 기존 foundation 값/Notifier/Key·physics 계산·curve·선별한 geometry/painting 값·Material 색은 원래 공개 import 경로의 구현을 공유합니다. Runner의 `routing`은 선택한 import를 기록하고 네 패키지의 실제 입력 파일을 검사합니다. 직접 경로의 미이식 구현과 별도 Core 복사본도 거부합니다. App-ready의 `execution`은 native ACK·fallback 거부 횟수와 이유를 보고하며 종전의 고정 fallback 수치를 제거했습니다. 이 허용을 기존 Widget 전체의 생성자·동작 호환으로 세지 않습니다. 이식 완료 기준과 남은 작업은 [work9 API 계획](../../work9-2.md#8-기존-공개-api-호환-작업)을 따릅니다. 종료 시점 근거는 [work8 기록](../../history/26/11/05/work8-2a-summary.md#현재-구현-현황)에 보존합니다.

### 원래 Element/State의 부분 연결

`@nelyx/sdk/engine-v2-original`의 `defineOriginalEngineV2App`을 명시적으로 선택하면 `build`에서 원래 Widget을 반환할 수 있습니다. 생성자와 import를 유지하며 canonical Element·State·Inherited·GlobalKey 수명은 App에서 실행합니다. 표준 객체의 설정을 C++ node로 전달하고 TS layout·paint·hit-test는 실행하지 않습니다.

```typescript
import { defineOriginalEngineV2App } from '@nelyx/sdk/engine-v2-original';
import { SizedBox, ColoredBox } from '@nelyx/core/framework/widgets/basic';

export default defineOriginalEngineV2App({
  build() {
    return new SizedBox(160, 80, new ColoredBox({ color: 0xff2468ac }));
  },
});
```

현재 지원하는 render 설정은 ConstrainedBox·Padding·기본 ColoredBox, Align/Center의 정렬·크기 배율, RTL/up을 포함한 Flex의 크기·간격·Expanded·overflow clip, 비 positioned Stack의 loose/passthrough/expand·수치 정렬·none/hardEdge clip입니다. Flex의 무한 main 제약은 flexible child가 없는 경우에 연결했습니다. Baseline·positioned child·anti-alias clip 등 아직 연결하지 않은 설정과 render object·instance hook·pointer/semantics callback·App 서비스는 명시적으로 실패합니다. 전체 Text·controller·디자인 API의 호환 경로가 아닙니다.

기본 `Text`는 provider font cohort로 LTR/RTL·정렬·locale·줄바꿈·maxLines/ellipsis·soft hyphen을 연결합니다. 크기·색상·text scaler·`DefaultTextStyle`, 문단 높이·음수를 포함한 간격·leading/height behavior, tight/loose 크기·기본 text semantics·clip/visible overflow를 지원합니다. 굵기 100–900과 단일 `fontFamily` 요청은 기존 provider 선택을 유지합니다. Native는 사용 가능한 설치 글꼴과 번들 cohort, Web은 선언한 provider 글꼴과 번들 대체 글꼴에서 선택하므로 같은 요청도 실제 글꼴이 다를 수 있습니다. `CupertinoSystemText`는 번들 기본 글꼴의 alias입니다. `RichText`·`Text.rich`는 상호작용 없는 canonical `TextSpan` 상속, run별 크기·굵기·italic·locale·글꼴 목록·단색 전경/배경·장식·OpenType features·명시적 variations·text shadows를 보존합니다. Source가 span 구성과 text scaler를 적용하고 C++가 shaping·배치를 수행합니다. Strut의 font/height/leading·강제 줄 높이·leading distribution도 연결했습니다. Original `RichText`·`Text.rich`는 canonical `WidgetSpan` 자식을 최대 64개 지원합니다. Core가 느슨한 inline 제약으로 자식을 측정하고 canonical text scale과 alphabetic/ideographic baseline을 적용한 뒤 Content의 placeholder box로 배치합니다. Ellipsis에서 빠진 자식 subtree는 paint·입력·semantics에서 숨깁니다. 강제 strut로 줄 box 밖에 나온 자식 그림은 문단 overflow 설정을 따르며 포인터 입력은 문단 box 안으로 제한합니다. 사용자 font/fontId·interactive/selectable TextSpan·추가 Paint style은 미완료입니다.

`framework/widgets/basic`의 `ClipRect`와 affine `Transform`(translate·rotate·scale·flip)은 C++ layout과 게시 frame의 geometry를 사용합니다. 원점·방향 정렬은 resize 뒤의 최종 크기를 포함해 Content에서 계산합니다. Singular 변환은 child를 그리지 않습니다. Perspective/3D 행렬·null이 아닌 `filterQuality`·`transformHitTests: false`는 현재 명시적으로 실패합니다.

별도 `framework/widgets/clip` API는 기본 ClipRect·ClipRRect·ClipOval·ClipPath, 네 clipBehavior와 방향별 타원 모서리 반경을 지원합니다. ClipPath는 기본 사각형을 사용합니다. Custom clipper는 App clip 질의가 실행되기 전에 거부합니다. 기본 rect/rrect/path 위젯은 proxy 사각형으로 hit-test하며, ClipOval은 Clip.none에서도 타원 hit-test를 유지합니다. 원래 API의 동작을 따릅니다.

원래 `framework/widgets/scroll-view`의 `ListView`·`ListView.builder`는 세로 고정 `itemExtent`, 유한 항목 수, `childPolicy: { mode: 'bounded' }`인 경우 C++ lazy list에 연결합니다. 원래 `ScrollController` 객체·position·동기 listener를 유지하고, 먼 위치의 `jumpTo`는 C++ seek 뒤 정확한 pixel offset으로 이동합니다. 기본 delegate의 key·keep-alive·repaint·semantic-index wrapper를 유지합니다. `animateTo`는 준비된 범위 안의 `Curves.linear`, 최대 1,900ms를 지원하며 완료는 native terminal에 연결합니다. Controller 교체는 내부 controller와의 전환을 포함해 같은 position과 scroll offset을 유지하고 원래 attach/detach callback을 실행합니다. 가변 높이·reverse·padding·복원·custom physics와 전체 keyboard/reader 동작은 미완료입니다. 이 경로의 전체 API 호환 상태는 `partial`입니다.

원래 `framework/widgets/gesture-detector`의 `GestureDetector`는 tap의 down/up/move/cancel·`onTap`·`onDoubleTap`, primary long-press callback과 pan·수평/수직 drag callback을 C++에 연결합니다. Callback은 원래 `Tap*Details`·`LongPress*Details`·`Drag*Details` 객체를 받습니다. Global/local 좌표·이동량·시각·종료 속도는 C++가 계산하며 `dragStartBehavior`와 `onlyAcceptDragOnThreshold`를 지원합니다. 눌림 callback에서 `setState`를 실행해 native ACK가 바뀌어도 같은 입력의 up/cancel을 유지합니다. App에서는 callback과 State만 실행합니다.

기본/opaque/translucent hit 설정과 tap/long-press semantics action을 연결합니다. 보조 버튼·double-tap details·scale/force·custom settings·장치 필터, pan과 방향 drag를 함께 등록하는 경우, 전체 중첩 arena·overflow 조상 hit 계약은 미완료이며 해당 미지원 옵션은 명시적으로 실패합니다. 전체 호환 상태는 `partial`입니다.

원래 `@nelyx/cupertino/button`의 `CupertinoButton`·`filled`·`tinted`는 기존 theme·ControlInteraction·WidgetStatesController·FocusNode를 유지합니다. Tap/long press·hover 상태·disable과 기본 semantics/Tab·Enter 활성화를 연결합니다. 기본 배경 장식·균일한 둥근 모서리·Opacity layer를 C++에 전달합니다. 원래 `AnimationController`와 post-frame callback은 요청한 host frame 시각으로 진행하며 App을 기다리는 native frame 장벽을 두지 않습니다. 직접 `OriginalWidgetHost`를 embed할 때는 `platform`을 제공하거나 canonical `FoundationPlatform`을 먼저 구성합니다. SDK 원래 앱 경로는 Native host/브라우저 환경을 구성합니다. OS cursor 모양 변경·전체 focus/shortcut/semantics 계약·복잡한 장식과 전체 Material/Cupertino API는 미완료입니다.

Web은 canvas와 해당 surface가 소유한 semantic DOM peer를 하나의 입력 surface로 처리합니다. Pointer capture가 이동해도 hover를 유지하고 surface를 벗어나면 exit를 전달합니다. 대표 browser 통합은 single-worker와 threaded에서 버튼 활성화·hover·실제 opacity pixel·종료 시 자원 회수를 확인합니다.

Original SDK entry는 일반 `ParagraphContext`를 통해 canonical `TextPainter.layout()`에 App 소유 동기 C++ paragraph 질의를 공급합니다. Service version 9와 Content가 같은 builder 정책·초기 bundled font cohort를 사용합니다. Flat/rich run의 즉시 metrics·UTF-16 box/hit/glyph/word/line 질의를 지원합니다. `ParagraphBuilder.addPlaceholder()`와 `TextPainter.setPlaceholderDimensions()`는 여섯 정렬·alphabetic/ideographic baseline·scale·쓰기 방향을 보존하고 고정 placeholder box를 동기로 반환합니다. 독립 TextPainter 질의는 주어진 dimensions를 사용하며 Original RichText·Text.rich의 자식 자동 layout은 Core에 연결합니다. 강제 strut의 줄 높이 밖으로 나온 글자 ink는 주변 clip이 적용될 때까지 보존합니다. Rich run마다 네 글자 ASCII OpenType feature 최대 64개·명시적 variation 좌표 최대 64개·text shadow 최대 16개를 보존합니다. 명시한 `wght`는 fontWeight에서 유도한 값보다 우선하며 그림자의 offset·blur를 Picture 기록 범위에 반영합니다. Core의 `fontResources` capability는 `EngineViewClient`에 분할 upload/read 경로를 제공합니다. Catalog는 최대 16 MiB, chunk는 256 KiB이며 기존 packet 1 MiB·resource 32 MiB 상한을 유지합니다. Upload token으로 재시도·취소를 구별하고 paragraph/scene의 세대별 holder가 producer 해제 뒤에도 이전 자원을 보유합니다. `setFontCatalog`는 embedder가 모든 provider owner를 먼저 준비한 뒤 호출하는 Core 제어입니다. Native Content와 두 Web profile은 해당 자원으로 불변 C++ font collection을 선택합니다. Web Content는 catalog를 분할 읽고 독립 Render owner가 자신의 collection을 준비한 뒤 Picture를 수락합니다. Picture API 2는 실제 C++ font stream·collection index를 공급한 face와 대조하고 원본 identity·variation 좌표를 기록하므로 같은 family 이름의 다른 font bytes를 구별합니다. `beginFontTransition`·owner 준비 ACK·`commitFontTransition`·`abortFontTransition`은 token과 입력 watermark로 Core revision 전환을 구별합니다. Content/Render가 실제 collection을 준비한 뒤 ACK하며 App/Content/Render가 모두 준비되어야 확정합니다. 취소·decode 거부는 기존 revision을 보존합니다. `releaseFontResource`는 문서 transaction과 독립적으로 producer를 해제합니다. Source recording은 App paragraph가 측정한 자원/revision을 고정합니다. App coordinator는 마지막 Source recording 또는 캡처한 scene의 lease까지 Core producer를 유지합니다. Canvas가 해제돼도 최신 desired scene과 ACK 대기 scene은 제한된 독립 hold를 유지합니다. Font와 이미지는 view 사이에서도 같은 SDK slot allocator를 사용합니다. 확정 여부가 불분명하면 terminal ACK로 소유권을 판단하며, 관측 cohort가 바뀌면 캐시한 TextPainter layout과 template metrics를 갱신합니다.

```ts
import { defineOriginalEngineV2App } from '@nelyx/sdk/engine-v2-original';
import { Text } from '@nelyx/core/framework/widgets/basic';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';

import { FontLoader } from '@nelyx/core/services/font-loader';
import { rootBundle } from '@nelyx/core/services/asset-bundle';

export default defineOriginalEngineV2App({
  async build(context) {
    const loader = new FontLoader('ReviewFont');
    loader.addFont(rootBundle.load('font.ttf'));
    await loader.load();
    return new Text('Example', {
      direction: 'ltr',
      style: new TextStyle({ fontFamily: 'ReviewFont' }),
    });
  },
});
```

App asset manifest에 `font.ttf`를 선언합니다. Font owner는 `build` 전에 준비되므로 async build와 이후 callback에서 FontLoader를 쓸 수 있습니다. Optional `fontCatalog`가 먼저 실행됩니다. Family의 모든 asset을 addFont로 등록한 뒤 load는 한 번 호출합니다. Subclass의 protected loadFont hook도 유지합니다.

App service 12은 동기 질의와 recording에 불변 font 세대를 보유하며 rollback과 마지막 holder의 회수를 지원합니다. `layout(input, revision)`·`snapshot(revision)`으로 보유 중인 cohort를 선택하므로 활성화 뒤 Core 확정을 기다리는 동안에도 이전 Source revision을 사용할 수 있습니다. 알 수 없거나 회수한 revision은 거부하고 잘못 관측한 Core revision은 이후 Source layout도 차단합니다. 늦은 이전 publication이 최신 관측 세대를 바꾸지 않습니다. App quota를 확보한 뒤 optional `fontCatalog`를 사용자 build와 Source mount 전에 적용합니다. Original SDK는 build 호출 전에 default FontLoader owner를 연결합니다. 런타임 `context.fonts.replace(catalog)`는 모든 owner를 준비하고 확정 revision을 반환하며 `replace(null)`은 bundled catalog로 복원합니다. `cancel()`로 admit된 active/대기 font load를 취소하고 `recover()`로 불명확한 terminal을 확인한 뒤 다음 전환을 시작할 수 있습니다. 한 번에 후보 하나를 허용합니다. 확정 cohort 변경은 Original View의 canonical systemFonts listener에 알립니다. 기존 relayout mixin은 그 View의 scheduler에서 callback을 합치고 scope 교체·dispose·close 때 pending 작업을 취소합니다. Native 렌더 객체는 TS PipelineOwner에 attach하지 않고 configuration 소유권을 유지하며 이전 recording의 geometry와 font revision을 보존합니다. Source FontLoader의 addFont/load 경로는 Original SDK에 연결했습니다. 공개 `loadFontFromList`는 `@nelyx/core/ui/fonts`에서 가져오며 같은 App 소유자를 사용합니다. `await loadFontFromList(bytes, { fontFamily: 'ReviewFont' })`로 별칭을 지정하고, 생략·null·빈 family는 입력 캡처와 임시 예산 확보 뒤 실제 Native/Web C++ decoder가 이름을 읽습니다. 성공하면 cohort와 Source 알림을 확정하며 잘못된 폰트·예산 초과·취소는 기존 cohort를 보존합니다. 패키지 rootBundle 로딩은 공유 App 소유자에 연결했습니다. ImageDescriptor/Codec의 불변 buffer 소비는 아래 범위로 연결했으며 OS font loading/알림은 미완료입니다. 별도 catalog가 없는 Original 앱은 번들의 `NelyxDefault`·`NelyxArabic`·`NelyxHebrew`·`NelyxEmoji` alias이며 `CupertinoSystemText`는 기본 글꼴로 매핑합니다. Service/version/font identity가 없으면 명시적으로 실패합니다. Painter 교체·dispose는 Source resource registry와 실제 holder 수명에 연결됩니다. App service 12의 pending App stage는 불변 catalog를 보유하고 실제 C++가 decode한 같은 bytes의 복사 chunk만 반환합니다. 호출자/SDK catalog·snapshot과 bounded 전송을 stage credit으로 계상하고 finish/rollback에서 회수합니다. Web의 별도 CanvasKit은 초기 128 MiB·최대 256 MiB heap을 사용하며 host가 worker 종료까지 320 MiB 예약을 유지합니다. Session 장부 상한은 768 MiB, GPU 상한은 128 MiB입니다.

FontLoader는 현재 불변 catalog에 추가하며 이전 family의 face와 fallback 순서를 보존합니다. SDK는 active/대기 load 최대 32개·캡처 font bytes 16 MiB를 제한하고 snapshot·bounded read·catalog 합성·전송 전에 App credit을 확보합니다. Load 중 `context.fonts.replace`는 busy를 반환합니다. Close는 admit된 작업과 credit을 회수하며 나중에 resolve한 Source asset future도 원래 owner를 유지해 다음 App으로 이동하지 않습니다. App service 12 snapshot의 `fontBuffers`·`fontBufferBytes`로 관측하며 foreign/중복 반환은 거부합니다. Quota가 부족하면 C++ 할당 전에 load가 실패할 수 있습니다.

Canonical native paint metadata는 `TextPainter.paint(Canvas, offset)`의 `paragraph` resource를 전달할 수 있습니다. Content가 복사된 불변 선언을 독립적으로 측정하고 font revision·geometry를 확인한 뒤 최종 부모 크기에서 준비한 Picture를 배치합니다. Threaded Web은 이미 공급한 글꼴의 참조와 실제 variation 좌표로 C++ Picture를 전달합니다. Render는 재조판이나 글꼴 파일 중복 전달 없이 복원하므로 배경·장식 path·glyph 위치·paint 순서를 보존합니다. Painter dispose 뒤에도 Canvas recording의 holder가 paragraph 수명을 유지합니다. 무한 폭 layout과 유한 recording bounds를 구별하며 save/restore·사각 clip·교차/foreground 순서를 보존합니다. 경계에서 Widget 자식을 그리고 paragraph 자원은 해당 스트림에서만 그립니다. 임의 Canvas/Picture/custom hook·추가 Paint style·일반 동기 RenderBox geometry는 미완료입니다. `execution.appText`의 실제 C++ layout/query와 SDK 호출·TS fallback, `sdkPaintCaptures`의 불변 recording capture를 대조합니다. Provider의 `fontReferencePictures`·`fontReferenceImports`·`fontReferenceBytes`는 실제 rich Picture 전달 작업입니다.

World 의존 native paint 프로그램과 참조가 있는 paint paragraph는 App·Content 호출 없이 C++ frame geometry를 사용합니다. Frame snapshot의 `framePaintWork`·`framePaintNodes`·`framePlacementNodes`와 provider의 node 진입 시 live stream/entry 수 `livePaints`·`livePaintEntries`, 실제 inline paragraph·foreground draw 수 `orderedParagraphs`·`foregroundPaints`를 구별합니다. 정적인 paint는 Content Picture에 유지합니다. 문단 참조나 자식 경계가 있는 스트림은 Core가 해석하고 Render가 그리며 raw entry 65개와 기존 전개 명령·path·operation 상한을 함께 적용합니다. Live 계산에도 frame별 식/path 예산과 소유 메모리 lease를 적용합니다. 잘못된 live 식은 명시적으로 실패하고 마지막 publication을 보존합니다.

State의 App 값은 즉시 바뀌고 native NACK에서도 원하는 값을 유지합니다. 기존 native 장면은 보존하며 inactive Element의 dispose는 알려진 native ACK 또는 close 뒤에 수행합니다. 원래 RenderBox의 동기 geometry는 아직 제공하지 않습니다. 해당 객체의 TS layout/query/hit-test는 거부하며 `context.view.layoutSnapshot()`으로 마지막 활성 layout의 부모 기준 좌표와 document/metrics revision을 비동기로 확인합니다. 합성된 transform과 property overlay는 게시 frame의 geometry에 속합니다. `execution.appModel`은 `original-elements`, `compatibility`는 `partial`로 보고하고 실제 native ACK 수를 집계합니다.

`BuildContext.services.readMetrics('logicalWidth', 'scale')`은 마지막으로 수신한 Core viewport의 불변 관측값을 반환합니다. Resize·배율 변경을 관측하면 선택한 필드가 바뀐 Element를 다시 build합니다. 인수를 생략하면 모든 필드를 구독합니다. Physical 크기는 provider와 같은 pixel 반올림을 사용하고, 제공하지 않는 native context/surface generation은 `null`입니다. 이 관측값의 viewport revision과 실제 활성 layout의 revision은 다를 수 있습니다. 동기 RenderBox geometry로 사용하지 마세요.

원래 Material의 `TextButton`, `FilledButton`/tonal, `OutlinedButton`, `ElevatedButton`은 source theme·State·controller를 유지합니다. 기본 rrect/stadium/circle shape·border·physical shadow와 highlight/InkRipple을 C++ geometry 및 Native/Web paint에 연결했습니다. 활성 pointer는 대상·조상 geometry가 같은 App 문서 교체에서도 8개 게시 상한 안에서 up/cancel을 유지합니다. Windows App SDK와 Web 두 profile에서 기본 버튼·disabled·hover·Enter와 실제 animation 표시를 확인했습니다. Padded tap target·custom shape/rect·다른 ink factory와 전체 디자인 API는 미완료입니다. [현재 구현 기록](../../work9-3.md#현재-구현검증과-잔여-작업)을 따르세요.

원래 `Checkbox`의 boolean/tristate와 `Radio`/`RadioGroup`은 source State·theme·Toggleable motion·그룹 callback을 유지합니다. C++가 check/dash·inset·원 중심과 반경을 계산하며 Web 두 profile에서 클릭·Enter/Space·disabled·3상태 왕복·Radio 선택 해제·방향키 이동과 그룹 Tab/Shift+Tab·ARIA·실제 표시를 확인했습니다. 비시각 Windows UIA 검사는 mixed 상태와 Radio SelectionItem/그룹 Selection, 선택된 `toggleable` Radio의 `RemoveFromSelection`을 포함합니다. 해제는 별도 요청으로 Source callback에 전달하며 ACK 전에 선택 값을 바꾸지 않습니다. 일반 Radio의 해제와 비활성·오래된 게시·종료 후 요청은 거부하고, 이미 선택되지 않은 Radio의 해제는 변경 없이 끝납니다. 최신 Native 선택/focus 표시·사용자 입력·외부 reader와 전체 선택 컨트롤 API는 미완료/미검증입니다. [현재 범위와 잔여](../../work9-3.md#현재-구현검증과-잔여-작업)를 따르세요.

원래 FocusNode·Actions/Shortcuts도 App 트리에 유지합니다. C++ focus owner와 실제 semantic peer를 연결하고 정확한 focus session으로 오래된 요청을 거부합니다. FocusNode rect/offset/size는 현재 관측한 게시 document·metrics·device의 C++ geometry를 읽으며 게시 전이나 알려진 stale 상태에서는 실패합니다. 임의 RenderBox의 동기 layout/geometry나 전체 API 호환을 제공하는 것은 아닙니다. Web의 Control+K 같은 source Shortcut과 비시각 Native의 callback 순서·GlobalKey 이동·키 down/repeat/up을 검증했습니다. 전체 scan/layout/raw keyboard·character/IME·reader 계약은 미완료입니다.

원래 `CupertinoSlider`와 Material `Slider`는 Source State의 controlled 값·divisions·callback·RTL·disabled 동작을 유지하고 C++ geometry·gesture·paint에 연결합니다. Material의 canonical 사각/둥근/gapped track·원형/handle thumb·overlay·tick은 Source theme·animation 값을 사용하며 예산이 제한된 paint 식을 최종 Content layout 크기로 해석합니다. Material label은 필수 App text service를 사용합니다. Canonical `Overlay` 조상이 있으면 기본 `DropSliderValueIndicatorShape`와 현대형 `RoundedRectSliderValueIndicatorShape`(`year2023: false`)가 기존 Source 표시 정책·State·animation·LayerLink와 기록한 text를 사용합니다. 항상 표시와 onDrag 정책, 시작 scale 0을 연결합니다. Drop 배경은 한 개의 복합 path로 그려 반투명 윤곽의 겹침과 stroke를 Source와 맞춥니다. C++가 매 frame의 현재 scroll·LayerLink transform에서 world 의존 paint와 기록한 text 배치를 다시 계산하고 준비한 glyph·Picture는 재사용합니다. 꼬리는 anchor를 따르고 말풍선·text는 별도의 화면 경계 보정을 유지합니다. 실제 Source 기본 Drop 장면은 두 Web profile의 App 지연과 threaded의 Content 지연 중 진행을 검증했으며 single-worker는 제한된 Content 작업 뒤 복구합니다. Native CPU raster도 같은 live paint 경로를 검증했으며 실제 창·물리 입력·성능 수락은 별도입니다. 다른 표시기/custom shape·debug shadow override와 전체 Slider/Raw 확장 계약은 미완료이며 필요한 경우 명시적으로 실패합니다. Original build ACK 뒤에 대기 중인 Source post-frame callback이 있으면 Core App-frame을 요청합니다. 내부 Slider surface의 size/globalToLocal은 마지막으로 관측한 유효한 게시 geometry만 읽으며 일반적인 동기 layout 질의를 제공하지 않습니다. 원래 RawGestureDetector의 canonical tap·수평/수직/pan factory와 View 소유 team을 부분 연결했으며 custom recognizer·buttons/devices/timers/velocity/semantics/team 설정은 거부합니다.

원래 `CompositedTransformTarget`·`CompositedTransformFollower`는 View 소유 `LayerLink`의 anchor·offset·unlink 표시를 C++ 합성 좌표에 연결합니다. 연결된 자식의 paint·pointer target·semantics가 같은 게시 좌표를 사용하고 Core scroll에서도 함께 이동합니다. Canonical Source `.layer` 객체·`LayerLink.leader/leaderSize`·`FollowerLayer.getLastTransform()`·`RenderFollowerLayer.getCurrentTransform()`은 완료한 native 게시 결과를 관측하며 ACK만으로 합성 상태를 앞당기지 않습니다. 첫 게시 전 `.layer`는 null이며 unlinked/관측 불가 follower 변환은 null, `getCurrentTransform()`은 기존 identity fallback을 반환합니다. LayerHandle은 Source 객체 identity를 유지하고 View를 닫을 때 mirror를 detach하며 외부 handle이 남아 있어도 View 참조를 해제합니다. Native Source layer는 관측용 mirror이며 직접 layer 수정·App SceneBuilder 합성·annotation 검색·Source rasterization은 연결하지 않았습니다. 일반 동기 layout 질의와 전체 custom/layer API는 미완료입니다. 중복 leader·다른 View의 링크 공유·잘못된 handle/paint 순서는 거부합니다. 이 부분 지원은 Native 물리 표시·reader 검증을 뜻하지 않습니다.

## 앱 API

`@nelyx/sdk`의 정확한 하위 경로에서 import합니다. 대상 이름은 `windows`, `android`, `ios`, `macos`, `linux`, `web`입니다.

| 모듈                                 | 용도                                     |
| ------------------------------------ | ---------------------------------------- |
| `platforms/<target>/application`     | 공통 앱과 backend 구성                   |
| `platforms/<target>/surface`         | 앱 렌더링 표면 표시                      |
| `platforms/<native-target>/controls` | 네이티브 컨트롤 연결                     |
| `runtime/config`                     | 앱 설정 읽기·검증                        |
| `runtime/assets`                     | 선언한 자산 로드·검증                    |
| `runtime/providers`                  | Provider profile과 런타임 요구 조건 확인 |
| `runtime/plugin-port`                | 앱 소유 플랫폼 plugin 연결               |
| `runtime/worker-messages`            | 명시적인 background 메시지 endpoint 연결 |

공개 export는 [package.json](package.json)에 있습니다. [Web surface 컴포넌트](../../sample/nelyx-testbed-app-2/web/runner/App.tsx)는 runner에서 `main().definition`을 `ApplicationSurface`에 연결하는 예입니다.

Windows `ApplicationSurface`의 기본값은 `windowsSurfaceStatusMode="lifecycle"`이며 backing별 첫 유효 갱신과 수명 전환을 받습니다. Surface-status protocol 1이 필요하므로 SDK와 함께 native host도 재공급·재빌드하세요. 공개 `SkiaGraphiteView`는 기본적으로 연속 callback을 유지합니다. 통지 방식을 비교할 때 `ApplicationSurface`에 `windowsSurfaceStatusMode="continuous"`를 지정할 수도 있습니다. Surface callback은 native 갱신 통지이며 실제 디스플레이 scanout 확인은 아닙니다.

RN `ApplicationSurface`의 실험 옵션 `nativeInputGeometry="retained"`는 편집기 좌표 준비를 C++로 처리합니다. 생략/`false`는 기본 TS 경로이며 `'snapshot'`은 기존 독립 후보를 선택합니다. 마운트한 owner마다 한 번 선택하고 전환할 때 remount하세요. Custom render hook은 TS 동작을 유지합니다. 이 옵션은 native hit-test index를 활성화하지 않습니다. 함께 재빌드한 native inputs·렌더러·SDK를 공급해야 하며 현재 런타임 검증 범위는 Windows입니다. 성능 채택 결과는 저장소 [work5.md](../../history/26/11/03/work5-summary.md)에 기록합니다.

명시적으로 요청한 C++ 서비스의 native capability가 없으면 시작 단계에서 오류를 냅니다. Windows 실행은 선택한 후보, 실제 native geometry commit, TS fallback 사유를 구분해 보고합니다. 저장소의 cadence 검사는 SDK/native 집계 일치와 warm Mixed 비교의 native 처리율 95% 이상을 요구합니다. 옵션 지정이나 API 존재만으로 통과하지 않습니다. 실제 Gallery → Mixed 경로와 활성화 실패 회귀는 `npm.cmd run test:retained-input-geometry`로 확인합니다.

## 설정과 provider

루트 `package.json`의 `nelyx`에 앱 설정을 선언합니다.

```json
{
  "nelyx": {
    "schema": "nelyx.app/v2",
    "name": "MyApp",
    "displayName": "My application",
    "appEntry": "./src/index.ts",
    "assets": [
      {
        "id": "app-font",
        "kind": "font",
        "path": "./assets/AppFont.ttf",
        "fontFamily": "AppFont",
        "notice": {"path": "./assets/AppFont-LICENSE.txt"}
      }
    ],
    "targets": {
      "web": {
        "profile": "ganesh-webgl2",
        "component": "./web/runner/App.tsx"
      }
    }
  }
}
```

실제 글꼴·고지 파일을 사용하세요. npm 패키지 이름과 네이티브 등록 이름인 `nelyx.name`은 별개이며, `displayName`은 화면에 표시할 이름입니다. Windows·Android profile은 [샘플 설정](../../sample/nelyx-testbed-app-2/package.json)에 있습니다.

Runner는 이 설정에서 `app-config.json`을 생성합니다. 변경할 때는 루트 패키지를 수정하고 준비 명령을 다시 실행하세요. 각 runner의 `main.ts(x)`가 플랫폼 컴포넌트를 import하고 `registerApplication`을 호출합니다.

[Provider manifest](providers/)는 대상별 profile, capability와 runtime cohort를 설명합니다. Core·SDK·렌더러 패키지, 네이티브 바이너리와 엔진 입력의 호환성을 맞춰야 합니다. Provider 검증 수준은 제공하는 capability와 별도로 기록합니다.

## 자산

V2 SDK 앱은 `nelyx.v2.json`에 asset을 선언합니다. 두 App 모델의 `context.asset(name)`과 canonical `rootBundle`/`PlatformAssetBundle`은 같은 패키지 bytes를 읽습니다. Original의 `DefaultAssetBundle.of(context)`는 ImageService 없이 App root를 쓰며 상위 bundle override를 보존합니다. CLI는 Nx variant가 포함된 binary manifest와 Web용 JSON/base64를 생성합니다. UTF-8 이름·공백을 지원하고 structured cache miss는 문자열 캐시를 거치지 않아 parser 실패 뒤 실제 bytes를 다시 읽습니다.

Canonical buffer API import는 동기 복사 요구를 알리며 SDK는 이 요구가 있으면 build 전에 공유 App 서비스를 준비합니다. Asset 읽기도 같은 서비스를 쓰며 Web은 해당 128 MiB CanvasKit heap·320 MiB host 예약을 사용합니다. Native는 할당 전 파일 크기, Web은 HEAD metadata 또는 생성한 asset index를 사용해 admit한 크기에 stream을 읽고 SHA-256을 검증합니다. 일반 HTTP 서버는 HEAD·공급자 hash header 없이 사용할 수 있습니다. Index는 별도의 제한된 credit을 보유하고 논리적 close 때 반환합니다. 실패·취소는 미전달 credit을 반환합니다. IO 대기 32개·admit된 buffer 64개·누적 admit data 32 MiB를 기존 App quota 안에서 제한하며 읽기마다 IO/복사·캐시 UTF-16을 위해 `3 * size + 65536` bytes를 예약합니다. 전달한 ByteData는 호출자가 보유할 수 있어 App realm 종료까지 credit을 유지합니다. Clear/evict는 Source cache를 지우지만 호출자 bytes를 회수하지 않습니다. 임의 parser 결과는 호출자가 관리합니다. Close는 새 IO를 거부하고 소유 IO를 취소·drain하며 Native runtime/Web worker 종료까지 전달 credit을 보존합니다. 전체 AssetBundle API 완료는 아닙니다.

Canonical `AssetBundle.loadBuffer()`와 `ImmutableBuffer`(`@nelyx/core/ui/immutable-buffer`에서도 제공)는 엔진 소유의 읽기 전용 bytes를 만듭니다. `fromUint8List()`는 Promise 반환 전에 선택한 view를 복사하므로 이후 caller 변경의 영향을 받지 않습니다. `fromAsset()`은 패키지 App 소유자, Native `fromFilePath()`는 UTF-8 로컬 경로를 사용하며 Web 파일 로딩은 명시적으로 실패합니다. Native는 SkData, Web은 CanvasKit 할당을 사용하고 Web upload/readback bytes는 SDK가 복사합니다. 모든 public buffer를 dispose하세요. 내부 엔진 holder나 진행 중인 읽기는 마지막 참조가 끝날 때까지 할당과 credit을 보유합니다. 살아 있는 buffer/reader와 해제 실패가 남으면 정상 close로 처리하지 않습니다. 복사 전에 할당당 `2 * size + 65536` bytes를 admit하며 owner별 live handle/할당 64개·live data 32 MiB·IO 대기 32개를 제한합니다. Buffer 전용 asset staging은 캡처 후 반환하고, 외부에 전달한 mutable ByteData credit은 별도로 realm 종료까지 유지합니다. `debugDisposed`와 중복/reentrant dispose 검사는 모든 build에서 동작합니다. 필수 `loadBuffer` 추가는 기존 구조적 클래스 타입을 확장하므로 해당 호환성 검토는 아직 미완료입니다.

```ts
import { rootBundle } from '@nelyx/core/services/asset-bundle';

export async function assetByteLength(key: string): Promise<number> {
  const buffer = await rootBundle.loadBuffer(key);
  try {
    return buffer.length;
  } finally {
    buffer.dispose();
  }
}
```

`NetworkAssetBundle`은 base URL 문자열에 상대 key·query·fragment와 절대 HTTP(S) key를 해석합니다. 매번 새로 요청하며 HTTP stack의 cache만 따릅니다. HTTP 200만 성공입니다. Native는 비동기 WinHTTP의 gzip/deflate·OS proxy/TLS·redirect 5회·IO timeout 30초, Web은 fetch stream과 browser CORS·TLS·redirect 정책을 사용합니다. 공통 App 소유자가 시작 중·실행 중 IO를 취소합니다.

HTTP 시작 전에 요청당 metadata·callback/전송 복사용 512 KiB를 admit하고 공통 IO 대기는 32개로 제한합니다. 길이가 있으면 읽기 전에 저장 공간을 확보하며 길이 미상·압축 stream은 할당 전에 `3 * capacity + 65536` bytes의 credit을 늘린 뒤 실제 전달 길이로 줄입니다. 누적 data 32 MiB와 App quota도 적용합니다. Raw caller bytes는 realm credit을 유지하고 `loadBuffer`는 불변 캡처 후 내부 staging을 반환합니다. Native 요청 credit은 마지막 close callback과 빌린 JSI 복사가 끝날 때까지 유지합니다. Browser/OS network buffering은 측정하는 소유 메모리 밖입니다. Data·Original App 선언 모두 Native ES2022에서 DOM ambient type을 요구하지 않으며 Web surface 인자는 정확한 browser 타입을 유지합니다.

```ts
import { NetworkAssetBundle } from '@nelyx/core/services/asset-bundle';

export async function remoteAssetByteLength(baseUrl: string, key: string): Promise<number> {
  const buffer = await new NetworkAssetBundle(baseUrl).loadBuffer(key);
  try {
    return buffer.length;
  } finally {
    buffer.dispose();
  }
}
```

App-ready의 `buildElapsedMs`에는 서비스 준비 비용을 포함하며 `servicesPreparationElapsedMs`도 별도로 보고합니다.

Web App bootstrap 계약 1은 App 종료·시작 실패 때 quota 대기·서비스 모듈·CanvasKit/폰트 다운로드도 취소합니다. Provider 다운로드 하나가 실패하면 나머지를 중단하고 모두 끝난 뒤 staging credit을 반환합니다. WebAssembly 초기화는 중단할 수 없어 결과를 기다리고 늦은 backend가 Source build나 asset reader에 전달되지 않게 합니다. 확정 heap과 고정 host 예약 320 MiB는 논리적 dispose 뒤에도 실제 worker 종료까지 유지합니다. Bootstrap capability가 없으면 provider 초기화 전에 실패합니다.

- 글꼴·이미지를 `nelyx.assets`에 선언하고 앱에서 참조할 고정 ID를 지정합니다.
- 라이선스 파일을 `notice.path`로 포함하면 패키징 시 자산과 함께 전달합니다.
- `sha256`을 지정하면 해당 bytes를 요구합니다. 생략하면 도구가 생성된 runner 메타데이터에 해시를 계산합니다.
- `packageSource`는 패키지가 export한 자산·고지를 앱으로 복사합니다. 수정된 기존 파일은 보존하고 충돌로 보고합니다.
- Runner의 Metro 자산 map이 요구하는 위치에는 literal `require` 항목을 추가합니다.

글꼴을 변경하면 패키지를 다시 공급하고 네이티브 앱을 재빌드하세요. 자산 준비 절차는 [Metro 가이드](tooling/metro/README.ko.md)에 있습니다.

## 플랫폼 서비스

앱은 SDK startup·View context를 통해 플랫폼 서비스를 받습니다. 클립보드, 환경·locale 관찰, 플랫폼 메시징과 편집·semantics 연결을 제공합니다. 미지원·권한 거부 OS 작업은 타입이 있는 플랫폼 오류로 보고합니다.

플랫폼 메시지 endpoint는 앱이 소유합니다. Background 연결은 호스트가 전달한 endpoint를 사용하며 Worker나 네이티브 worker runtime 생성은 호스트 책임입니다. Worker를 종료하기 전에 연결의 비동기 해제를 기다리세요.

## 이미지 descriptor와 Codec

두 v2 App 모델은 사용자 build 전에 canonical `ui/image-descriptor`·`ui/image-decoder`를 연결합니다. ImageDescriptor를 import하면 App image service 2가 필요하며 없으면 build 전에 실패합니다. `ImageDescriptor.encoded(buffer)`는 실제 Skia decoder로 정보를 읽고, 동기 `raw(buffer, {width, height, rowBytes, pixelFormat})`는 premultiplied rgba8888/bgra8888·행 padding을 받습니다. Descriptor는 공개 buffer와 독립적으로 backing을 유지하고 Codec은 descriptor를, 반환 canonical Image는 ImageService/ResourceRegistry를 통해 독립 frame을 유지합니다. 각 소유 handle을 dispose하세요. instantiateImageCodecFromBuffer/WithSize는 실패 때도 buffer 소유권을 가져가며 instantiateImageCodec(bytes)는 첫 await 전에 호출자 bytes를 캡처합니다.

```ts
import {instantiateImageCodec} from '@nelyx/core/ui/image-decoder';

export async function firstImagePixels(encoded: Uint8Array): Promise<Uint8Array | null> {
  const codec = await instantiateImageCodec(encoded);
  try {
    const {image} = await codec.getNextFrame();
    try { return await image.toByteData(); }
    finally { image.dispose(); }
  } finally { codec.dispose(); }
}
```

현재 decoder control은 실제 Native SkCodec과 기존 소유 CanvasKit heap의 PNG·2-frame GIF 순서/시간/반복·RGBA/BGRA·resize·clone/read·취소/해제를 확인합니다. Encoded 16 MiB·각 축 8192·16 Mi-pixel·descriptor/codec 각 32·frame 64·resident 64 MiB 제한 안에서 픽셀 할당 전에 작업 메모리를 확보합니다. Native descriptor는 SkData를 공유하고 Web encoded/raw transport 복사는 확보한 credit을 사용합니다. 반환 premultiplied rawRgba/rawUnmodified ByteData는 별도 credit(64결과·합계 32 MiB)을 App realm 종료까지 유지합니다. Image native 픽셀은 마지막 holder/read가 끝나면 해제합니다.

이 v2 경로의 floating-point raw/target·PNG/straight-alpha readback은 명시적으로 거부합니다. Canvas 연결·나머지 형식/복구 승인은 미완료입니다. Decoder 검증은 표시된 이미지 frame이나 성능 승인이 아닙니다.

v2 `ImageResource` 경로는 큰 encoded 이미지를 256 KiB chunk로 나누며 기존 packet 1 MiB·resource 32 MiB 예산을 유지합니다. `EngineViewClient`의 `beginImageUpload`·`appendImageUpload`·`finishImageUpload`·`readImageResource`·`releaseImageResource`를 사용합니다. 전체 upload를 마친 뒤에만 자원을 게시하고 token별 동일 재전송은 허용하며 바뀐 bytes는 거부합니다. WidgetHost는 첫 await 전에 큰 payload를 캡처하고 불확실한 upload는 terminal 재확인까지 유지합니다. Content read는 preparation 또는 보유 frame에 묶이므로 producer 해제와 slot 재사용 뒤에도 이전 bytes를 읽습니다. Native Content는 decode한 픽셀을 기록하고 Web Content는 bounded chunk를 읽어 Picture를 Render로 전달합니다. Canonical RawImage는 아래의 별도 Scene snapshot 계약을 사용합니다. CPU·Web pixel 검증은 물리 display·성능 승인이 아닙니다.

기본 Original App bridge는 canonical `RawImage`/`RenderImage` frame을 불변 RGBA Scene 자원으로 그립니다. 사용자 build 전에 App image service 2를 요구합니다. 같은 App의 Image/clone은 확보한 snapshot 한 개를 공유하며 호출자 Image나 codec을 해제해도 보유 Scene/Picture 픽셀은 유지됩니다. Snapshot credit은 반환 `toByteData` credit과 별도이며 수락된 이전 트리·불확실한 upload·마지막 참조 해제까지 유지합니다. Core가 이미지 크기/scale·모든 BoxFit·alignment·repeat tile·RTL 반전·nine-patch 배치와 박스 밖 그리기 범위를 계산합니다. Native Skia와 CanvasKit은 같은 배치에 opacity·tint/blend·색 반전·filter quality를 적용합니다. Attach하지 않은 Source render object의 opacity 변경은 View scheduler가 관찰합니다. Canvas 연결·나머지 형식/복구는 미완료입니다. Native CPU·Web 픽셀 검증은 물리 display·성능 승인이 아닙니다.

기본 Original App은 canonical Image Widget과 MemoryImage·AssetImage·ResizeImage·NetworkImage를 공통 ImageService/ImageCache와 예산을 확보한 불변 buffer decoder에 연결합니다. Native FileImage는 절대 file:/// URI를 사용하며 Web 로컬 파일 IO는 지원하지 않습니다. Image frame과 timer는 View의 실제 Core timestamp와 절대 deadline을 사용하며 callback 수를 제한하고 eviction/close 때 취소합니다. TickerMode는 움직이는 stream의 픽셀 진행을 정지합니다. NetworkImage는 제한한 호출자 header·수신 byte 진행률·진행 중 읽기 취소를 지원하며 기본 Original App은 사용자 build 전에 HTTP header service 2를 요구합니다. Native는 빈 asset key의 정확한 URL을 보존하고 교차 origin redirect에서 호출자 Authorization/Cookie header를 제거합니다. 공개 asset/file/network ByteData credit은 decoder·Scene credit과 별도로 realm 종료까지 유지합니다. Native decoder/IO control과 일반 Web 픽셀 검사는 cache 재사용·resize·GIF frame·회수를 확인하며 visibility/복구·Canvas 연결과 물리/성능 승인은 별도입니다.

## 책임과 수명

| 소유자              | 책임                                                |
| ------------------- | --------------------------------------------------- |
| Core                | 위젯, 상태, 레이아웃, hit test와 논리 semantics     |
| SDK TypeScript      | Backend 구성, 입력, 자산, 서비스와 View 수명        |
| SDK 네이티브 호스트 | VM·bootstrap, 창, event loop와 앱 종료              |
| Skia 패키지         | 렌더링, 문단, 이미지, GPU 제출과 작업 완료 후 해제  |
| 플랫폼 runner       | 의존성, 등록 코드, Metro·Babel과 네이티브 빌드 파일 |

앱 소유 서비스를 정리하고 비동기 해제를 기다리세요. View 종료는 새 입력·프레임 수락을 닫은 뒤 네이티브·GPU 작업 완료를 기다립니다. 완료 확인에 실패하면 종속 자원을 보존하므로 종료 오류를 그대로 처리해야 합니다.

네이티브 호스트 소스는 [native/](native/), 런타임 pin·overlay는 [../upstream/](../upstream/)에 있습니다. 플랫폼 제약은 [프로젝트 가이드](../../README.ko.md#프로젝트-상태)를 참고하세요.

## 빌드와 확인

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run build:sdk
npm run check --workspace @nelyx/sdk
```

SDK 빌드는 Core·디자인·렌더러 패키지도 빌드하고 provider·CLI 입력을 준비합니다. 대상별 빌드는 [CLI 가이드](tooling/cli/README.ko.md), runner 설정은 [Metro 가이드](tooling/metro/README.ko.md)에 있습니다.

## 라이선스

Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 가져온 코드의 고지는 [licenses/](licenses/)에 유지합니다.
