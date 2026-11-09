# Nelyx Core

[English](README.md) | **한국어**

소비자 프로젝트는 **TypeScript >=7.0.0**을 사용하며 생성 runner는 **7.0.2**로 고정합니다. Runner 검사는 설치된 compiler의 공개 package metadata와 실제 실행 버전을 확인합니다. 생성 설정은 폐지된 `baseUrl` 없이 상대 paths와 명시한 app root를 사용합니다.

Workspace의 `tsc`는 `@typescript/native` alias의 native TypeScript 7.0.2를 사용합니다. Shader/declaration AST 변환과 원래 API inventory는 Microsoft TypeScript 6 호환 API를 유지합니다. 패키지 빌드는 호환 API emit 전에 native 7.x 프로젝트 검사를 통과해야 합니다. [Microsoft API 전환 안내](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)를 참고하세요.

`@nelyx/core`는 Nelyx의 플랫폼 독립 TypeScript UI 프레임워크입니다. Widget·Element·RenderObject 트리, 상태, 레이아웃, 페인트, 제스처와 앱 계약을 관리합니다. [SDK](sdk/README.ko.md)가 플랫폼을 연결하고 [Skia](skia/README.ko.md)가 렌더링을 제공합니다.

설치와 샘플 실행은 [프로젝트 가이드](../README.ko.md)에서 시작하세요.

## 실험용 v2 엔진 protocol

`@nelyx/core/v2`는 C++ 엔진의 packet codec·명령·`EngineClient`·`createWasmTransport`를 제공합니다. 원본 계약은 [engine/schema/protocol.json](engine/schema/protocol.json)이며 저장소 루트의 `node Nelyx/engine/tools/generate-schema.mjs --check`로 C++/TS 생성본 일치를 검사합니다. `npm.cmd run build:core`가 기존 Core export와 이 subpath를 함께 빌드합니다.

저장소 루트에서 `npm.cmd run build:engine-v2`를 실행합니다. HWND/Hermes/Skia host, 두 engine Wasm profile, provider worker·기본 font와 owned CanvasKit **m153-nelyx-paragraph.6** 자산(npm 0.41.0 package는 선언 제공)을 현재 `Nelyx/engine/dist`에 공급합니다. Wasm에는 [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) **4.0.22**가 필요하며 `EMSDK` 또는 사용자 cache의 `.cache/tooling/emsdk`에서 찾습니다. Windows는 고정된 local Skia/Hermes 공급을 사용하고 누락·불일치를 거부합니다. 엔진 빌드는 App package나 Testbed UI를 빌드하지 않습니다. 아래 실행 명령이 Core/Material/Cupertino/SDK를 준비하고 기존 Testbed 후보를 `sample/nelyx-testbed-app-2/engine-v2/dist/v2-<target>`에 별도로 빌드합니다. App 변경은 App bundle을, native/provider/protocol 변경은 엔진 공급을 무효화합니다. 교체 후 staging·이전 출력을 제거합니다.

- Windows: `npm.cmd run run:engine-v2:windows`. Wheel 또는 왼쪽 pointer drag로 스크롤하고 `Ctrl+U`로 App 선언을 갱신합니다. 창을 닫으면 provider를 drain하고 owner를 join합니다.
- Web: `npm.cmd run run:engine-v2:web` 후 `http://127.0.0.1:8192/isolated/`에서 threaded 자동 선택, `/plain/`에서 비격리 single-worker 자동 선택을 확인합니다. `?profile=threaded`는 격리가 필요하며 명시 요구·자산/ABI 오류는 TS renderer 전환 없이 실패합니다. 정적 배포에는 CLI의 `pack --engine v2 --target web` 출력을 사용하고 격리 route의 worker/asset에 일관된 COOP/COEP headers를 제공해야 합니다.
- 개발 확인: `npm.cmd run check:types`, `npm.cmd run lint`, `npm.cmd run format:check`와 위 제품 빌드·실행 명령을 사용합니다. 독립 회귀 테스트와 API 감사 도구는 2026-11-07 사용자 요청으로 제거했습니다.

Windows/threaded Web은 독립 Content/Render owner를 연결합니다. Single-worker는 협력 실행이며 `contentIndependent=false`입니다. Testbed는 v2 Widget/State/Key로 선언하고 C++ layout·intrinsic/dry query·편집 document·semantics를 사용합니다. Arabic/Hebrew fallback·color emoji를 공급합니다. 전체 Widget/Material/Cupertino API·gesture·Android는 **PARTIAL**이며 실제 IME/reader·trackpad/FPS 수락은 별도입니다. [work8 구현 기록](../history/26/11/04/work8-2-summary.md#이번-작업의-구현검증-현황)과 [work9 잔여 계획](../work9.md)을 참고하세요.

Client는 승인 document와 scene 활성화를 구별합니다. ACK timeout 뒤에는 보관한 bytes의 `queryCommitResult()` 또는 `retryCommit()`을 사용하며 이미 승인된 변경을 취소한 것으로 간주하지 않습니다. Provider frame hold가 남으면 close는 `busy`를 반환하므로 host가 먼저 회수해야 합니다. `reservedBytes`는 내부 reservation이며 process RSS나 별도 GPU/provider heap의 합계가 아닙니다.


`commands.layout(node, options)`로 C++ layout을 선택합니다. Box 계열·Flex·Stack·Wrap·Grid·ScrollViewport primitive의 자식 layout을 C++가 수행합니다. `direction`, `mainSize`, `mainAlign`, `crossAlign`, `flex`/`fit`, `gap`/`runGap`, `columns`, 각 변의 `padding`을 지정합니다. 양수 width/height는 부모 제약 안의 선호 크기이며 0은 자연 크기입니다. 명시적인 빈 박스는 tight zero 제약을 사용하세요. Unbounded expand·미지원 정렬/layout 조합은 명시적으로 실패합니다.

Text/Image/EditableText에도 같은 계약의 padding을 지정할 수 있습니다. Node snapshot의 `content` rect는 border box 내부의 paint 영역이며 baseline·편집 geometry에도 padding을 반영합니다. Wrap/Grid stretch는 run별 자식 재측정을 사용하고 수평 baseline을 지원합니다. Grid `mainAlign`은 세로 행 배분, `mainSize: 'max'`는 유한 높이 확장, `crossAlign`은 행 안의 자식 정렬입니다. Box/Stack은 start/center/end·cross stretch/baseline·유한 주축 확장을 지원합니다. V2 primitive의 계약이며 Flutter 전체 API 호환을 뜻하지 않습니다.

`view.dryLayout(node, horizontal, vertical)`와 `view.intrinsic(node, 'minWidth'|'maxWidth'|'minHeight'|'maxHeight', oppositeExtent)`는 Content에서 비동기로 계산하며 document/metrics/font를 결과에 포함합니다. Dry는 실제 layout continuation을 사용하고 활성 scene을 바꾸지 않습니다. View당 query 1개이며 취소·timeout·metrics/font/device 변경을 검사합니다. 크기를 결정할 수 없는 viewport/sliver intrinsic과 expand query는 지원하지 않습니다.

같은 v2 subpath의 `WidgetHost`, `StatelessWidget`, `StatefulWidget`, `State`, `InheritedWidget`, `ValueKey`, `GlobalKey`와 `Box`, `Row`, `Column`, `Stack`, `Wrap`, `Grid`, `ScrollView`, `Text`, `Image`, `EditableText`, `Button`, `Semantics`로 장면을 선언합니다. `mount`/`update`/`flush`는 ACK 기준으로 diff하고 Key 재부모화·상태·NACK/ACK 유실을 처리합니다. 표준 자식 layout은 C++에 남습니다. 기존 v1 Widget import를 이 경로에 자동 연결하지 않습니다.

GlobalKey 재부모화는 `deactivate`/`activate`와 의존성 갱신을 수행합니다. 초기화·갱신 lifecycle에서 build 전에 `setState`를 호출할 수 있습니다. Build 실패는 Element 정보·미전송 할당을 복구하며 앱의 임의 부수 효과까지 되돌리지 않습니다. Hook이 예외를 던져도 dispose는 terminal입니다. `WidgetHost.close()`는 모든 State와 native view를 정리한 뒤 하나의 오류는 원래 객체로, 여러 오류는 `AggregateError`로 반환합니다. Focus된 collapsed caret는 C++의 500 ms deadline으로 깜박이고 조합 중에는 고정 표시, selection/blur에서는 정지합니다. 게시 frame의 `caretVisible`로 표시 상태를 구별하며 Widget/paragraph를 다시 만들지 않습니다.

`fontResources` capability는 분할 font catalog upload/read(최대 16 MiB·chunk 256 KiB), 불변 paragraph binding과 token별 준비 장벽을 제공합니다. `beginFontTransition()`의 후보는 producer 해제 뒤에도 보유하며 각 App/Content/Render owner가 준비를 ACK합니다. `commitFontTransition()`은 세 owner의 준비와 현재 입력 watermark를 요구하고 확정된 요청은 같은 bytes로 재시도할 수 있습니다. `abortFontTransition()`·owner decode 실패는 기존 revision을 보존합니다. `releaseFontResource()`는 이미 해제한 세대에 대해 멱등입니다. Original 앱은 SDK의 `fontCatalog`·`context.fonts`로 준비·교체·취소·복구를 조정할 수 있습니다. 확정 cohort는 View scheduler를 통해 Original Source 렌더 객체에 알립니다. Canonical Source FontLoader는 Original SDK에서 family를 순차 로드합니다. `@nelyx/core/ui/fonts`의 공개 `loadFontFromList`도 같은 App 소유자를 사용하며 family 생략 시 실제 C++ decoder가 이름을 읽습니다. 패키지 rootBundle asset은 두 SDK App 모델에서 읽기 전 예산과 App 소유자를 사용합니다. `loadBuffer`/`ImmutableBuffer`는 엔진 소유 불변 캡처·Native 로컬 파일·마지막 holder 회수를 지원합니다. Web byte upload/readback은 소유 CanvasKit heap에 SDK가 복사하며 NetworkAssetBundle은 공통 App 소유자의 bounded HTTP(S) stream·취소를 사용하며 ImageDescriptor/Codec은 실제 Native/Web CPU decoder와 canonical Image 수명까지 불변 buffer를 유지하며 RawImage/RenderImage Scene 표시를 지원하며 기본 Original App은 ImageProvider/ImageCache를 같은 decoder·Core 시계에 연결하며 Canvas 연결은 미완료입니다. Web App 종료는 provider 준비도 취소하며 진행 중인 Wasm 초기화가 끝난 뒤 dispose합니다. OS font 변경 알림과 나머지 asset API는 미완료이며 [SDK text 계약](sdk/README.ko.md)을 따릅니다.

v2 `ImageResource` 경로는 큰 encoded 이미지를 256 KiB chunk로 나누며 기존 packet 1 MiB·resource 32 MiB 예산을 유지합니다. `EngineViewClient`의 `beginImageUpload`·`appendImageUpload`·`finishImageUpload`·`readImageResource`·`releaseImageResource`를 사용합니다. 전체 upload를 마친 뒤에만 자원을 게시하고 token별 동일 재전송은 허용하며 바뀐 bytes는 거부합니다. WidgetHost는 첫 await 전에 큰 payload를 캡처하고 불확실한 upload는 terminal 재확인까지 유지합니다. Content read는 preparation 또는 보유 frame에 묶이므로 producer 해제와 slot 재사용 뒤에도 이전 bytes를 읽습니다. Native Content는 decode한 픽셀을 기록하고 Web Content는 bounded chunk를 읽어 Picture를 Render로 전달합니다. Canonical RawImage는 아래의 별도 Scene snapshot 계약을 사용합니다. CPU·Web pixel 검증은 물리 display·성능 승인이 아닙니다.

기본 Original App bridge는 canonical `RawImage`/`RenderImage` frame을 불변 RGBA Scene 자원으로 그립니다. 사용자 build 전에 App image service 2를 요구합니다. 같은 App의 Image/clone은 확보한 snapshot 한 개를 공유하며 호출자 Image나 codec을 해제해도 보유 Scene/Picture 픽셀은 유지됩니다. Snapshot credit은 반환 `toByteData` credit과 별도이며 수락된 이전 트리·불확실한 upload·마지막 참조 해제까지 유지합니다. Core가 이미지 크기/scale·모든 BoxFit·alignment·repeat tile·RTL 반전·nine-patch 배치와 박스 밖 그리기 범위를 계산합니다. Native Skia와 CanvasKit은 같은 배치에 opacity·tint/blend·색 반전·filter quality를 적용합니다. Attach하지 않은 Source render object의 opacity 변경은 View scheduler가 관찰합니다. Canvas 연결·나머지 형식/복구는 미완료입니다. Native CPU·Web 픽셀 검증은 물리 display·성능 승인이 아닙니다.

기본 Original App은 canonical Image Widget과 MemoryImage·AssetImage·ResizeImage·NetworkImage를 공통 ImageService/ImageCache와 예산을 확보한 불변 buffer decoder에 연결합니다. Native FileImage는 절대 file:/// URI를 사용하며 Web 로컬 파일 IO는 지원하지 않습니다. Image frame과 timer는 View의 실제 Core timestamp와 절대 deadline을 사용하며 callback 수를 제한하고 eviction/close 때 취소합니다. TickerMode는 움직이는 stream의 픽셀 진행을 정지합니다. NetworkImage는 제한한 호출자 header·수신 byte 진행률·진행 중 읽기 취소를 지원하며 기본 Original App은 사용자 build 전에 HTTP header service 2를 요구합니다. Native는 빈 asset key의 정확한 URL을 보존하고 교차 origin redirect에서 호출자 Authorization/Cookie header를 제거합니다. 공개 asset/file/network ByteData credit은 decoder·Scene credit과 별도로 realm 종료까지 유지합니다. Native decoder/IO control과 일반 Web 픽셀 검사는 cache 재사용·resize·GIF frame·회수를 확인하며 visibility/복구·Canvas 연결과 물리/성능 승인은 별도입니다.

`EditingController('초깃값')`를 `EditableText`에 부착한 뒤 `refresh()`로 revision을 받고 `edit({kind:'replace',revision,text,base,extent,policy})`로 조건부 수정합니다. Text/selection/composing은 Core가 보유하고 undo/redo를 제공합니다. 같은 handle의 초깃값을 바꾸지 말고 편집 명령을 사용하세요. OS/browser composing 종료 전 App replacement는 거부될 수 있습니다. `semanticsSnapshot()`은 게시 world geometry와 최신 비시각 편집 값을 구별하며, `focus()`/`semanticAction()`은 게시 ID·focus session·node 세대를 검사합니다. Windows는 TSF/UIA, Web은 `dom-textarea/aria`를 연결합니다. 실제 IME 후보창·전체 keyboard/clipboard/reader 조합은 미검증입니다.

원래 `Semantics`의 identifier·정규 `OrdinalSortKey` 그룹·`customSemanticsActions`를 Windows/Web bridge에 연결했습니다. Core가 최종 geometry로 게시 의미 트리의 순서를 정하고, Windows는 AutomationId·가상 Invoke 항목, Web은 ARIA ownership·접근성 action 버튼으로 전달합니다. 저수준 client는 `semanticAction(node, publication, 'custom', 0n, action.id)`를 호출합니다. 임의 sort-key subclass는 아직 지원하지 않습니다. Windows 외부 UIA Invoke·reader 음성 검증은 남아 있으며 [work9-b](../work9-b.md)에 범위를 기록합니다.

정규 keyboard 입력은 host가 관측한 `key/code/location`을 Core publication 검사 뒤 Source Focus/HardwareKeyboard로 전달합니다. Web은 DOM identity를 보존하고 Windows는 수정한 RNW table과 WM_KEY scan/extended 필드를 소비합니다. 저수준 `keyBody(publication, virtualCode, down, modifiers, repeat, clipboardSnapshot, {key, code, location})`는 상한이 있는 UTF-8 identity를 받으며 기존 숫자 packet도 유지합니다. Resize/focus 경계에서 준비되지 않은 관측은 거부합니다. Windows layout별 label·dead key·물리 장치 수락은 PARTIAL입니다. Demo → Text inputs → Test keyboard에서 Source 키 콜백을 볼 수 있습니다. 방향이 다른 semantics label/hint 병합도 Source의 방향 embedding을 보존합니다.

원래 Focus와 입력 콜백은 상한이 있는 App 큐를 공유합니다. Web pointer packet도 DOM focus·key와 같은 UI 큐를 사용하므로 버튼 콜백이 부모 Focus를 요청한 뒤 이전 DOM focus가 늦게 도착하지 않습니다. Source 요청은 해당 입력의 native focus session을 보존하고 더 새로운 native focus나 목표 제거 때 취소합니다. Focus rect는 Core가 게시한 bounds를 소비하며 키 묶음의 관측이 어긋나면 원래 동기 traversal 전에 새로 조회합니다. Demo의 Test keyboard는 별도 부모 Focus를 요청하고 자식의 키 이벤트도 받습니다. 전체 custom geometry·IME·OS 접근성 수락은 남아 있습니다.

`new ListView({generation: 1n, itemCount: 2000, estimatedExtent: 48, itemKey: i => i, itemBuilder: i => new Box([], {properties: {height: 48}})}, {properties: {width: 300, height: 400}})`로 필요한 세로 구간만 생성합니다. 데이터/순서 변경 때 `generation`을 올리고 재배치 때 `findChildIndex`를 제공합니다. C++ 실측 extent·활성화 시점의 key anchor 교정은 준비 중 들어온 입력도 보존합니다. `cacheItems`는 focus/명시 keep-alive를 포함해 8–128개(기본 96)입니다. Async builder는 `placeholder`가 필요하며 동시 4개·2초 timeout으로 제한됩니다. `ListBuildSignal`을 받고 Web fetch에는 `nativeSignal`을 사용할 수 있습니다. Eviction/generation/dispose는 abort하며 늦은 결과를 버립니다. `direction: 'horizontal'`로 수평 목록을 지정합니다. 활성 layout을 관찰한 뒤 `key.currentState.scrollToIndex(index, alignment)`는 먼 목적지를 준비한 후 visual offset을 교체합니다. 반환은 pending command receipt이며 `onScrollTerminal`에서 같은 ID의 완료/취소/timeout을 받습니다. 사용자 입력·generation 변경·2초 준비 timeout은 seek를 종료합니다. Provider/GPU 예약은 session ledger에 합산하며 불투명한 provider/driver 순간 peak는 선제 관측 범위 밖입니다.

이 Core Widget에는 명시적인 `@nelyx/material/v2`, `@nelyx/cupertino/v2`를 사용합니다. 지원 생성자의 button·selection control·slider/progress·editor·surface가 native 상태/paint를 선언합니다. Testbed는 두 패키지와 2,000행 목록을 실행합니다. `NavigatorController`/`Navigator`는 최대 32 route 보존·modal barrier를 제공합니다. 기존 v1 디자인 패키지보다 작은 API이며 전체 form 검증·테마/아이콘/전환·일반 SDK resolver 이식은 남습니다.

`new GestureDetector(child, protocol.gestures.tap | protocol.gestures.longPress, callback)`로 C++ recognizer를 선언합니다. Tap/double tap/long press·축 pan·2-contact pinch·hover·scrollbar drag, control pressed/hover/value·slider step·keyboard activation은 App callback 응답을 기다리지 않습니다. Pinch는 결과 event를 보내며 임의 content zoom transform·전체 중첩 gesture arena·모든 physics는 남습니다.

`NodeOptions.onRawInput`은 원 sample과 게시 ID를 받습니다. WidgetHost가 구독을 시작하며 overflow의 `onRawGap(first, last)` 이후에는 `view.subscribeRaw()`로 명시적으로 재구독합니다. 별도 64 sample 상한·poll당 32개이며 observer 지연은 native scroll을 막지 않습니다. `appControlled(sample)`은 해당 node만 sample별 비동기 boolean 승인 경계로 지정합니다. Stream당 outstanding 1개·100 ms deadline이며 겹친 sample은 명시적으로 cancel합니다. 승인은 Render tick에서 한 번 적용하고 늦은 reply는 stale입니다. 다른 표준 native stream은 독립적으로 진행합니다.

Windows UI·Web Main은 입력 수집 시 `InputPacket.publication`과 metrics/수집 시각을 고정합니다. Admission된 packet은 해당 Frame을 소비 때까지 보유하므로 새 게시가 target을 바꾸지 않습니다. Admission 전 이미 회수된 게시 ID는 명시적으로 거부하며, snapshot hold는 input 상한과 Core bytes 장부에 포함됩니다.

Editor의 명시적인 `commit`/`cancel` replacement는 host의 실제 composition-end 확인을 기다립니다. Native busy 재시도는 같은 ID/bytes를 사용하고 Web은 DOM 입력 큐 밖에서 종료를 기다립니다. 확인이 없으면 제한 시간 내 실패 결과를 냅니다. Windows는 보유 paragraph의 grapheme/word/line geometry로 이동·삭제하며 v2는 명시적으로 최대 65,536 UTF-16-unit query 예산을 사용합니다. Focus와 새로 준비된 caret는 두 축의 기존 prepared ancestor viewport 안에서 reveal하며 사용자 scroll은 그 수요를 취소합니다. Editor 내부 scroll·먼 focus lazy item의 자동 준비·모든 bidi affinity·EditContext character bounds·물리 IME/clipboard/reader 수락은 남습니다. Windows 복사/잘라내기/붙여넣기 실패는 편집 문서를 보존하고 clipboard 소유권을 해제합니다.

`await view.layoutSnapshot()`은 마지막 활성화 layout을 반환합니다. Node 좌표·baseline은 부모 기준이며 `layoutDocument/layoutMetrics`가 해당 geometry의 버전입니다. 새 document 승인이나 host metrics 변경만으로 좌표의 버전을 바꾸지 않습니다. `commands.text(node, value, size, color, {direction: 'rtl'})`로 RTL을 지정합니다. Web 공급 font의 hash를 manifest와 대조하고 worker 사이 glyph run에도 font identity를 유지합니다.

`commands.coverage(scrollNode, revision, {minimum, maximum})`는 논리 extent와 별개로 준비된 **visual offset** 범위를 선언합니다. `NeedChildren`을 coverage revision별로 합칩니다. 활성 engine-driven gesture만 한 viewport 이내의 최신 목표 하나를 보관하고 반전/end/cancel/hide에서 버립니다. Phase 없는 wheel은 지연 목표를 누적하지 않습니다. 추종 속도는 min(2,400 px/s, 4 viewport/s), tick당 최대 적용 시간은 1/60초입니다. 준비 밖 programmatic 목적지는 `contentUnavailable`로 끝납니다. `ListView`는 실제 builder와 native anchor 교정을 연결합니다.

### 그래픽·App geometry·통합 메모리

`Transform(child, [a,b,c,d,tx,ty])`, `ClipRRect`, `ClipPath`, `PathShape(new VectorPath(segments, fillRule))`, `ImageFiltered(child, sigma)`로 affine transform·둥근/path clip·하위 트리 blur를 선언합니다. `NodeOptions.graphics`는 shadow·stroke도 받습니다. Path는 move/line/quad/cubic/close 최대 1,024개, sigma는 0–64입니다. 명시적인 빈 clip path는 모든 픽셀/입력을 가립니다. Paint·입력·접근성은 같은 게시 matrix를 사용하며 곡선 hit-test는 0.25 단위의 bounded 평탄화입니다. Raster 경계의 antialiasing 오차는 별도로 구분합니다.

`NativeSparkline(values, width, height, options)`는 정적으로 컴파일된 C++ 확장입니다. 2–256개 정규화 sample을 엔진이 path로 만들며 App handshake에 `protocol.capabilities.nativeExtensions`를 요구합니다. 유한한 명시 geometry를 사용하며 크기를 바꿀 때 새 확장 선언을 보냅니다. `AppDrivenBoundary(width, height, children)`는 모든 자손에 유한한 width/height를 요구하고 그 경계의 native 자식 layout을 끕니다. App은 엔진 layout/paint 호출 밖에서 완성한 위치를 선언합니다.

신뢰한 host의 단일 ledger가 Core·provider·전송·staging과 GPU 예약을 총 768 MiB/GPU 128 MiB 상한으로 admission합니다. `state.memory`에 total/peak/rejected·engine/CanvasKit committed heap과 분류별 값을 반환하고 engine heap 안의 Core 논리 자원은 중복 합산하지 않습니다. Windows는 App packet/turn 경계에서 Hermes heap·외부 buffer도 provider-heap 계정에 합산합니다. Native CPU·GPU는 보수적 예약량을 포함하며 RSS나 실제 driver VRAM 측정이 아닙니다. Owned CanvasKit 공급은 인스턴스당 초기 128 MiB·최대 256 MiB linear heap을 사용합니다. 내부 allocation/growth는 공개 API 경계에서 관측하고 committed heap 초과는 session 실패로 처리합니다. Original App의 동기 C++ paragraph 질의 owner는 로드 전에 320 MiB를 예약하며, host가 App worker를 종료한 뒤에만 그 예약을 반환합니다. Browser의 App/host adapter JavaScript heap과 불투명한 provider/driver allocation 순간의 peak는 이 장부의 측정 대상이 아닙니다. App port에서 host 메모리 계정을 변경할 수 없습니다.

`Key`·`ValueKey`·`ObjectKey`·`UniqueKey`와 Notifier 계열은 기존 값 import와 `/v2`에서 원래 foundation 구현을 공유합니다. Reconciliation은 사용자 정의 key 동등성·런타임 type token을 보존하고 `ValueListenableBuilder`는 원래 listener 계약으로 구독·해제합니다. 기존 GlobalKey/RenderObject framework와 동기 API 전체를 이식한 것은 아닙니다.

`WidgetHost.execution`은 ACK를 받은 native 명령/transaction·App geometry 선언·fallback 거부 횟수와 이유를 보고합니다. ACK 전에는 `observed=false`이며, C++ `transactionWork` 및 해당 장면의 실제 layout/paint 작업과 대조합니다. 미지원 Widget은 `fallbackPolicy: 'reject-unported'`로 실패합니다. 빌드 manifest의 `routing`에는 실제 검사한 import graph가 있습니다. 종전의 고정 `fallbacks=0`을 대신하며 성능·display 수락과는 구별합니다.

일반 entry·자산·단독 패키지는 [SDK runner 안내](sdk/README.ko.md#일반-v2-프로젝트)를 따릅니다. 허용한 기존 value API는 원래 source/생성자를 재사용합니다. 독립 API 감사 도구는 제거했으며 기존 전체 Widget/RenderObject/디자인/SDK API 호환성은 계속 미완료입니다. [work9 API 호환 계획](../work9-2.md#8-기존-공개-api-호환-작업)과 [work8 기록](../history/26/11/05/work8-2a-summary.md#현재-구현-현황)을 참고하세요.

일반 App은 `@nelyx/sdk/app`과 원래 Widget/Element/State 클래스를 사용합니다. Box/Flex/Stack·정렬/padding·clip·transform·RepaintBoundary·ColoredBox는 각 Core 모듈에서 native 설정을 제공합니다. Scene compiler는 정확히 등록한 prototype의 설정을 읽으며 TS layout/paint/hit-test를 실행하거나 미등록 render subclass를 허용하지 않습니다. Paragraph/image와 다른 render 계열의 잔여 이관은 [work9-b](../work9-b.md)에서 관리합니다.

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
