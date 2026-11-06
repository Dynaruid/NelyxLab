# Nelyx SDK

[English](README.md) | **한국어**

`@nelyx/sdk`는 [Core 프레임워크](../README.ko.md)를 플랫폼 앱, 렌더링 표면, 입력, 자산, OS 서비스와 호스트 수명에 연결합니다. 공통 앱 코드는 `src/`에 두고 각 플랫폼 runner가 등록 코드와 빌드 설정을 제공합니다.

전체 앱 예는 [Testbed 가이드](../../sample/nelyx-testbed-app-2/README.ko.md), 새 앱 생성은 [CLI](tooling/cli/README.ko.md)를 참고하세요.

## 실험용 v2 packet port

`@nelyx/sdk/engine-v2`는 `connectEngineV2Host(host, options)`를 제공합니다. v2 packet transport와 `engine: 'v2'`·`abiMajor`·`schema`를 가진 `identity`를 전달합니다. Facade의 bundle/host 검사 뒤 C++ handshake가 요청한 capability를 검사합니다. 빌드 명령·ACK 재시도·활성화·close/drain은 [Core v2 안내](../README.ko.md#실험용-v2-엔진-protocol)를 참고하세요.

`createBrowserEngineV2Surface(canvas, { root: new URL('/engine/', location.href), profile: 'auto' })`로 공급된 worker runtime을 새 canvas에 연결합니다. 현재 engine dist 전체를 `root`에서 제공해야 합니다. 반환 surface는 packet host·App port·진단·비동기 `close()`를 제공합니다. Main은 bounded input/viewport를 전달하고 C++가 scene 좌표·scroll·hit-test를 소유합니다. `auto`는 격리/shared memory가 있으면 threaded, 없으면 single-worker를 선택합니다. 명시 capability 누락·공급 오류는 v1 fallback 없이 시작 실패로 처리합니다. Close는 provider/worker를 drain하며 다음 session은 새 canvas가 필요합니다.

브라우저를 숨기면 준비 결과 cache를 비우고 GPU cache 한도를 줄입니다. 별도 embedder가 메모리 압력 신호를 받으면 `surface.setMemoryPressure(true)`를 호출하고 해제 시 `false`를 전달할 수 있습니다. 이 호출은 요청이며 `diagnostics['memory-pressure']`가 실제 owner 적용 결과를 보고합니다. 현재 게시는 계속 사용할 수 있고 압력 중에도 필요한 새 장면을 준비합니다. Windows host는 OS의 low-memory resource notification을 직접 관측합니다. Cache 축소를 Wasm heap·진행 중인 GPU 작업·driver 메모리의 즉시 반환으로 해석하지 않습니다.

자체 Windows host와 두 Web profile에서 v2 Widget/State/Key·C++ layout/intrinsic/dry query·편집 document·semantics를 사용하는 Testbed를 실행합니다. Web surface는 `dom-textarea/aria` 입력 carrier와 게시 geometry 기반 peer를 만들고 App의 edit/focus/action도 같은 Main 큐에서 순서대로 처리합니다. App port는 24 request/3 MiB까지 사용하고 전체 32 request/4 MiB 중 나머지를 Main 입력에 예약합니다. Windows는 STA UI owner의 실제 TSF context·UIA Fragment/Value/Text/Invoke를 연결합니다. 빌드/실행과 API는 [Core 안내](../README.ko.md#실험용-v2-엔진-protocol)를 참고하세요. 전체 Widget/Material/Cupertino·gesture·Android 이식과 물리 IME/reader·성능은 PARTIAL입니다. [work8 실행 기록](../../history/26/11/04/work8-2-summary.md#이번-작업의-구현검증-현황)에 당시 검증 경계를 보존하고, [work9.md](../../work9.md)에서 잔여 작업과 새 host 계획을 관리합니다.

### 일반 v2 프로젝트

Windows App SDK 후보를 선택하려면 `nelyx.v2.json`에 `"windowsHost": "windows-app-sdk"`를 추가한 뒤 Windows build/run/pack을 수행합니다. 현재 공급의 `windows-app-sdk` profile이 필요하며, 실제 AppWindow·Microsoft.UI dispatcher와 기존 Graphite/Vulkan renderer를 사용합니다. 실행 프로젝트는 고정 `Microsoft.WindowsAppSDK@1.8.260508005`의 unpackaged/self-contained 배포를 만들고 App SDK DLL·MSVC CRT·license를 함께 제공합니다. 필수 runtime이나 공급 identity가 없으면 시작 검사를 거부합니다. 기존 기본값은 `windows-hwnd`이며, 새 후보의 전체 API·물리 입력·성능 수락은 [work9](../../work9.md)에서 별도로 관리합니다.

저장소 Testbed는 `npm.cmd run build:engine-v2` 후 `npm.cmd run run:engine-v2:windows-app-sdk`로 실행합니다. `V2_WINDOWS_HOST`는 실제 host/dispatcher 경로를, `V2_INPUT_SOURCE`는 DirectManipulation 입력의 admission/rejection 수를 보고합니다. 주입 wheel·자동 UIA 검사로 물리 precision trackpad 사용감을 승인하지 않습니다.

일반 v2 공급 빌드는 준비된 `m153-nelyx-paragraph.1` CanvasKit의 manifest·파일 hash·paragraph API 1을 검사합니다. 준비물이 없거나 다르면 빌드를 거부합니다. [Owned runtime 준비 안내](../skia/eng/source-build/README.md)를 따르세요. npm CanvasKit은 타입 선언에 사용하며 앱 실행 중 vendor 다운로드/빌드를 시작하지 않습니다.

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

기본 `Text`는 provider의 번들 font cohort로 LTR/RTL·start/end/left/right/center/justify·locale·softWrap/nowrap·maxLines/ellipsis·manual soft hyphen을 연결합니다. 문단 설정의 hidden 모드도 지원합니다. 크기·색상·text scaler·`DefaultTextStyle`, 문단 높이·음수를 포함한 간격·leading/height behavior, tight/loose 크기·기본 text semantics·clip/visible overflow를 지원합니다. 일반 굵기 400의 font·shaping·geometry는 provider가 소유하고 App registry에는 설정 참조만 둡니다. `CupertinoSystemText`도 이 번들 cohort를 사용합니다. 사용자 font/fontId·다른 App 서비스의 font, rich span·다른 굵기/italic·strut·추가 style은 미완료입니다. 동기 text 서비스 질의는 명시적으로 실패합니다.

`framework/widgets/basic`의 `ClipRect`와 affine `Transform`(translate·rotate·scale·flip)은 C++ layout과 게시 frame의 geometry를 사용합니다. 원점·방향 정렬은 resize 뒤의 최종 크기를 포함해 Content에서 계산합니다. Singular 변환은 child를 그리지 않습니다. Perspective/3D 행렬·null이 아닌 `filterQuality`·`transformHitTests: false`는 현재 명시적으로 실패합니다.

별도 `framework/widgets/clip` API는 기본 ClipRect·ClipRRect·ClipOval·ClipPath, 네 clipBehavior와 방향별 타원 모서리 반경을 지원합니다. ClipPath는 기본 사각형을 사용합니다. Custom clipper는 App clip 질의가 실행되기 전에 거부합니다. 기본 rect/rrect/path 위젯은 proxy 사각형으로 hit-test하며, ClipOval은 Clip.none에서도 타원 hit-test를 유지합니다. 원래 API의 동작을 따릅니다.

원래 `framework/widgets/scroll-view`의 `ListView`·`ListView.builder`는 세로 고정 `itemExtent`, 유한 항목 수, `childPolicy: { mode: 'bounded' }`인 경우 C++ lazy list에 연결합니다. 원래 `ScrollController` 객체·position·동기 listener를 유지하고, 먼 위치의 `jumpTo`는 C++ seek 뒤 정확한 pixel offset으로 이동합니다. 기본 delegate의 key·keep-alive·repaint·semantic-index wrapper를 유지합니다. `animateTo`는 준비된 범위 안의 `Curves.linear`, 최대 1,900ms를 지원하며 완료는 native terminal에 연결합니다. Controller 교체는 내부 controller와의 전환을 포함해 같은 position과 scroll offset을 유지하고 원래 attach/detach callback을 실행합니다. 가변 높이·reverse·padding·복원·custom physics와 전체 keyboard/reader 동작은 미완료입니다. 이 경로의 전체 API 호환 상태는 `partial`입니다.

원래 `framework/widgets/gesture-detector`의 `GestureDetector`는 tap의 down/up/move/cancel·`onTap`·`onDoubleTap`, primary long-press callback과 pan·수평/수직 drag callback을 C++에 연결합니다. Callback은 원래 `Tap*Details`·`LongPress*Details`·`Drag*Details` 객체를 받습니다. Global/local 좌표·이동량·시각·종료 속도는 C++가 계산하며 `dragStartBehavior`와 `onlyAcceptDragOnThreshold`를 지원합니다. 눌림 callback에서 `setState`를 실행해 native ACK가 바뀌어도 같은 입력의 up/cancel을 유지합니다. App에서는 callback과 State만 실행합니다.

기본/opaque/translucent hit 설정과 tap/long-press semantics action을 연결합니다. 보조 버튼·double-tap details·scale/force·custom settings·장치 필터, pan과 방향 drag를 함께 등록하는 경우, 전체 중첩 arena·overflow 조상 hit 계약은 미완료이며 해당 미지원 옵션은 명시적으로 실패합니다. 전체 호환 상태는 `partial`입니다.

원래 `@nelyx/cupertino/button`의 `CupertinoButton`·`filled`·`tinted`는 기존 theme·ControlInteraction·WidgetStatesController·FocusNode를 유지합니다. Tap/long press·hover 상태·disable과 기본 semantics/Tab·Enter 활성화를 연결합니다. 기본 배경 장식·균일한 둥근 모서리·Opacity layer를 C++에 전달합니다. 원래 `AnimationController`와 post-frame callback은 요청한 host frame 시각으로 진행하며 App을 기다리는 native frame 장벽을 두지 않습니다. 직접 `OriginalWidgetHost`를 embed할 때는 `platform`을 제공하거나 canonical `FoundationPlatform`을 먼저 구성합니다. SDK 원래 앱 경로는 Native host/브라우저 환경을 구성합니다. OS cursor 모양 변경·전체 focus/shortcut/semantics 계약·복잡한 장식과 전체 Material/Cupertino API는 미완료입니다.

Web은 canvas와 해당 surface가 소유한 semantic DOM peer를 하나의 입력 surface로 처리합니다. Pointer capture가 이동해도 hover를 유지하고 surface를 벗어나면 exit를 전달합니다. 대표 browser 통합은 single-worker와 threaded에서 버튼 활성화·hover·실제 opacity pixel·종료 시 자원 회수를 확인합니다.

State의 App 값은 즉시 바뀌고 native NACK에서도 원하는 값을 유지합니다. 기존 native 장면은 보존하며 inactive Element의 dispose는 알려진 native ACK 또는 close 뒤에 수행합니다. 원래 RenderBox의 동기 geometry는 아직 제공하지 않습니다. 해당 객체의 TS layout/query/hit-test는 거부하며 `context.view.layoutSnapshot()`으로 마지막 활성 layout의 부모 기준 좌표와 document/metrics revision을 비동기로 확인합니다. 합성된 transform과 property overlay는 게시 frame의 geometry에 속합니다. `execution.appModel`은 `original-elements`, `compatibility`는 `partial`로 보고하고 실제 native ACK 수를 집계합니다.

`BuildContext.services.readMetrics('logicalWidth', 'scale')`은 마지막으로 수신한 Core viewport의 불변 관측값을 반환합니다. Resize·배율 변경을 관측하면 선택한 필드가 바뀐 Element를 다시 build합니다. 인수를 생략하면 모든 필드를 구독합니다. Physical 크기는 provider와 같은 pixel 반올림을 사용하고, 제공하지 않는 native context/surface generation은 `null`입니다. 이 관측값의 viewport revision과 실제 활성 layout의 revision은 다를 수 있습니다. 동기 RenderBox geometry로 사용하지 마세요.


Material native shape/ink와 가변 font weight는 구현 중이며 대표 앱은 아직 통과하지 않았습니다. 현재 소스를 검증할 때 engine 공급을 다시 빌드해야 합니다. [일시정지·재개 기록](../../work9-3.md#외출-일시정지-기록)을 따르세요.

## 앱 API

`@nelyx/sdk`의 정확한 하위 경로에서 import합니다. 대상 이름은 `windows`, `android`, `ios`, `macos`, `linux`, `web`입니다.

| 모듈 | 용도 |
| --- | --- |
| `platforms/<target>/application` | 공통 앱과 backend 구성 |
| `platforms/<target>/surface` | 앱 렌더링 표면 표시 |
| `platforms/<native-target>/controls` | 네이티브 컨트롤 연결 |
| `runtime/config` | 앱 설정 읽기·검증 |
| `runtime/assets` | 선언한 자산 로드·검증 |
| `runtime/providers` | Provider profile과 런타임 요구 조건 확인 |
| `runtime/plugin-port` | 앱 소유 플랫폼 plugin 연결 |
| `runtime/worker-messages` | 명시적인 background 메시지 endpoint 연결 |

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

- 글꼴·이미지를 `nelyx.assets`에 선언하고 앱에서 참조할 고정 ID를 지정합니다.
- 라이선스 파일을 `notice.path`로 포함하면 패키징 시 자산과 함께 전달합니다.
- `sha256`을 지정하면 해당 bytes를 요구합니다. 생략하면 도구가 생성된 runner 메타데이터에 해시를 계산합니다.
- `packageSource`는 패키지가 export한 자산·고지를 앱으로 복사합니다. 수정된 기존 파일은 보존하고 충돌로 보고합니다.
- Runner의 Metro 자산 map이 요구하는 위치에는 literal `require` 항목을 추가합니다.

글꼴을 변경하면 패키지를 다시 공급하고 네이티브 앱을 재빌드하세요. 자산 준비 절차는 [Metro 가이드](tooling/metro/README.ko.md)에 있습니다.

## 플랫폼 서비스

앱은 SDK startup·View context를 통해 플랫폼 서비스를 받습니다. 클립보드, 환경·locale 관찰, 플랫폼 메시징과 편집·semantics 연결을 제공합니다. 미지원·권한 거부 OS 작업은 타입이 있는 플랫폼 오류로 보고합니다.

플랫폼 메시지 endpoint는 앱이 소유합니다. Background 연결은 호스트가 전달한 endpoint를 사용하며 Worker나 네이티브 worker runtime 생성은 호스트 책임입니다. Worker를 종료하기 전에 연결의 비동기 해제를 기다리세요.

## 책임과 수명

| 소유자 | 책임 |
| --- | --- |
| Core | 위젯, 상태, 레이아웃, hit test와 논리 semantics |
| SDK TypeScript | Backend 구성, 입력, 자산, 서비스와 View 수명 |
| SDK 네이티브 호스트 | VM·bootstrap, 창, event loop와 앱 종료 |
| Skia 패키지 | 렌더링, 문단, 이미지, GPU 제출과 작업 완료 후 해제 |
| 플랫폼 runner | 의존성, 등록 코드, Metro·Babel과 네이티브 빌드 파일 |

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
