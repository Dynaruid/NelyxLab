# 엔진 v2 2a — API 호환·실행 검증·종료·Flutter 비교 요약

원문: 루트 `work8-2a.md` · 작성·구현 갱신·종료: **2026-11-05 KST** · 보관: **2026-11-05 KST**

문서: **CLOSED / SUPERSEDED** · 구현: **PARTIAL / 전체 API 호환 gate FAIL / npm 종료 원인 미확정**. 마지막 구현 현황·동작/공급 수치와 미커밋 Flutter 비교를 보존하고, 그 이전 재검토 중 핵심 실패·조사 경계를 요약했다. 본문 수치·‘현재’는 당시 기록이며 이번 보관에서 runtime/API audit/hash·성능을 재검증하지 않았다.

[보관 목차](../04/work8-summary.md) · [2부](../04/work8-2-summary.md) · [3부](../04/work8-3-summary.md) · [후속 work9](work9-summary.md)

## 현재 구현 현황

사용자의 후속 구현 요청으로 진행한 마지막 구현·검증 기록을 보존한다. 시작 HEAD는 `15b85f5`였으며 원문의 이전 §1–8 재검토보다 이 결과가 우선했다. 본문에서 말하는 ‘현재/이번/최종’은 당시 실행 구간이며 이번 보관의 새 결과가 아니다.

| 우선 작업 | 반영한 구현과 경계 |
| --- | --- |
| 원래 API 범위 고정 | [공개 표면 계약](../../../../Nelyx/engine/schema/public-api.json)에 **4개 패키지·834 subpath·4526 code export 발생 항목 + 15 non-code 항목**을 고정했다. Module/symbol 삭제와 overload/member/protected 표면 변경은 실패한다. 이 파일은 검사 결과 이력이 아니라 gate가 읽는 원래 호환 범위의 소스다. 정상 audit는 이를 자동 갱신하지 않는다 |
| Audit 입력과 대응 | [audit/2](../../../../Nelyx/engine/tools/api-audit.mjs)는 선언·runtime 파일·module/reexport 해석·TypeScript 진단을 검사한다. 빈 module과 asset/header/license 경로도 미검증 항목으로 남긴다. 생성자/call overload·generic·readonly/optional·static/instance/protected hook·index signature/type alias 정의·양방향 타입 대입을 기록한다. `any`의 양방향 대입만으로 서로 다른 index 타입을 승인하지 않으며, 이름이 같은 v2 후보와 실제 원래 import route를 구별한다 |
| 동작 증거 | [실행 사례](../../../../Nelyx/engine/tools/api-behavior.mjs)는 `--verify` 호출 안에서 실제 공개 module을 로드한다. 사례마다 overload/member 범위를 명시하며 일부를 검사한 class의 나머지는 `unverified`에 남는다. 사례 파일의 존재·signature·허용 목록만으로 합격시키지 않는다. 명시 route와 일치하는 새 구현도 실제 사례와 모든 의무가 충족돼야 승인 가능하며, 그 gate 자체의 성공/실패 회귀가 있다 |
| 실제 경로 보고 | `WidgetHost.execution`의 ACK 명령/transaction·App geometry 선언·fallback 거부 횟수/이유를 수집한다. ACK 전에는 `observed=false`다. 종전 `fallbacks=0`/`tsFallbacks=0`을 삭제했다. 미지원 Widget은 TS renderer 실행 없이 거부하며 세 profile에서 **거부 횟수 1**, 이후 정상 작업과 C++ `transactionWork` 대조를 검사한다. App geometry 선언 수는 TS layout/paint fallback 실행 수가 아니다 |
| 일반 runner graph | [실제 입력 검사](../../../../Nelyx/sdk/tooling/cli/src/engine-v2-graph.mjs)가 Core/Material/Cupertino/SDK 입력을 검사한다. `routing`은 선택한 공개 import와 package별 입력 수를 보고한다. 직접 source 경로의 미이식 디자인 구현과 별도 Core 복사본도 거부하며, 실패 시 이전 bundle을 유지한다. Build graph는 runtime 성능 증거가 아니다 |
| 복합 종료 오류 | [공통 수명 처리](../../../../Nelyx/runtime/engine-client/lifecycle.ts)를 SDK/Testbed/client에 연결했다. App·Widget·transport·Web surface 정리를 모두 시도하고, 오류 하나는 원래 객체를, 여러 오류는 순서가 있는 `errors`·첫 `cause`·각 메시지를 보존한다. 중복/재진입 close는 같은 Promise를 반환한다. Packet unsubscribe/endpoint close가 함께 실패해도 admitted 요청을 reject하고 timer를 회수한다 |
| Native 출력 경합 | 실제 host 검사에서 `V2_STATS` JSON 안에 `V2_INPUT_FRAME`이 끼어드는 실패를 재현했다. 모든 host owner의 출력에 C++20 `osyncstream`을 적용해 한 레코드씩 출력한다. 이 결함은 npm 설치 프로세스의 0xC0000409와 별개다 |
| Archive 소비자 | Core/SDK/Material/Cupertino/CLI/Metro/Static AOT를 실제 pack/install하는 사례로 확장했다. 두 디자인의 설치 JS 동일성·junction 부재·**설치된 TypeScript와 CLI**·Windows 및 plain/isolated portable package 실행과 drain을 검사한다. 생성 프로젝트에는 고정 TypeScript dev dependency를 추가했다. 전체 기존 API/모든 platform 소비 검증은 아니다 |
| npm 재발 진단 | 기존 env 분리·compiler 종료·finally 정리를 유지했다. 외부 자식 명령 실패 시 Node/npm real path·version·cwd·status/signal·출력 크기·그 시점의 메모리와 금지 환경 key 유무를 보고한다. Env 값/token·상시 dump·검사 이력 파일은 남기지 않는다 |

### 이번 검증

| 검사 | 결과와 증거의 범위 |
| --- | --- |
| `test:engine-v2` | **214/214**. 세 profile에서 ACK 전 `observed=false`·실제 거부 횟수 1·정상 회복 후 C++ 명령 수 대조를 포함 |
| API gate·수명 | `test:engine-v2:api` **7/7**: 누락/해석 실패·명시 route 성공·미검증 overload·protected/generic/readonly·표면 축소·index/alias·non-code/빈 module. `test:engine-v2:lifecycle` **3/3**: 복합 오류의 cause/순서·재진입 Promise·단일 오류 identity·endpoint 두 실패와 pending 회수 |
| `test:engine-v2:hosts` | **5/5**. 실제 Testbed ACK 명령 **1210 = C++ transactionWork 1210**, layoutWork **445**·graphics record **14**·native extension **1**. Windows TSF/UIA·50/100/200 ms App/Content 지연·lazy seek·resize/idle·drain, 두 Web profile·시작 실패 회귀. Native ledger 종료 0, provider/render 작업을 확인. Web은 SwiftShader 기능 검사 |
| `test:engine-v2:runner` | **8/8**, 일반 `npm.cmd` 명령. Native/plain/isolated 일반 앱 3, App+Widget 및 Web surface 복합 실패/중복 close 3, Native 무한 JS dispose 중단 1, **7개 실제 archive의 설치 compiler/CLI·두 디자인·세 host portable 실행 1**. Native에서도 구조화한 `cause`/`errors`를 검사하며, 실패 close 뒤 ledger/provider 회수 확인 |
| glyph·actor·graphics | **3/3 + 3/3 + 2/2**. 동일 Core/provider 소스의 25 glyph pixel corpus·UTF-16·owner 일정·실제 CanvasKit CPU retained pixel·backing 거부와 회수 |
| 기존 입력·paragraph | `test:input-geometry` **2/2**, `test:retained-input-geometry` **7/7**, `test:skia-paragraph-queries` **1/1**. 기존 Gallery/Material/Mixed/custom hook·활성화 실패 경계 유지 |
| 소유권·정적 검사 | Package ownership 회귀 **5/5**, 현재 graph **968 source / 7673 runtime edge / design cycle 0**, design ownership 통과. 전체 workspace·CLI·Web adapter 타입, lint, format **1856파일**, schema·공백 검사 통과. 문서 링크와 최종 공급 hash는 아래에 기록 |

Archive 검사의 첫 Native 실행은 `windowsHide:true`로 GUI를 숨겨 activation timeout으로 실패했다. [ShowWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-showwindow)의 첫 호출은 부모의 STARTUPINFO 표시 조건을 따르므로, 실제 GUI를 검사하는 fixture를 기존 일반 Windows 검사와 같은 `windowsHide:false`로 고쳤다. 이후 전체 **8/8**을 확인했다. Hidden-start의 일반 제품 수락이나 npm 종료 결함 해결로 확대하지 않는다.

이번 archive 설치에서 **0xC0000409 재발은 관측하지 않았다.** 최종 공급으로 다시 실행한 전체 runner는 **8/8**, 약 122초였고 archive 사례는 약 80초였다. 시간은 검사 실행 기록이며 제품 성능 수치가 아니다. 이전 두 fast-fail의 parameter/stack은 확보하지 못했으며 npm 근본 원인 미확정을 유지한다. 실패한 검사도 finally로 browser/server/native/설치본·archive를 정리했다.

최종 [공급 manifest](../../../../Nelyx/engine/dist/engine-manifest.json)는 **33파일 / 4 font**, ABI major **2** / schema **2587795476**, qualification **host-integration-candidate**다. Source SHA-256은 `c69b2977dced7e94fb1f454b2ae7c9fa653938d6d5b3ad193057f3c70f2608f0`이며 현재 `sourceIdentity()`와 일치하고 공급 file hash 불일치는 **0개**다. 이 공급으로 host **5/5**와 일반 runner **8/8**을 다시 확인했다. 검사 종료 뒤 소유 Native/Node/browser process **0개**, 해당 임시 소비자·archive·API/코어 검사 디렉터리 **0개**, package/engine staging·이전 출력 **0개**다. 문서 **9개·로컬 링크 384개·앵커 156개**와 `git diff --check`를 통과했다. Native stats의 App counter는 마지막 App 보고 시점의 snapshot이며, 전체 입력 구간의 live fallback/성능 계측으로 확대하지 않는다.

전체 API audit의 일반 명령 `npm.cmd run audit:engine-v2:api`는 **exit 1 / inputValid=false / compatible=false**다. 현재 선언을 모두 함께 검사한 엄격한 진단에서는 의존 라이브러리의 Node/RN·DOM/WebGPU 전역 충돌 **81건**, 저장소 자체 선언 진단 **0건**, 원래 scope 불일치 **0건**이다. Workspace 타입 검사는 기존 `skipLibCheck` 설정에서 통과한 별도 검사다. 진단을 숨겨 API gate를 통과시키지 않는다.

| 패키지 | 기존 subpath | missing | signatureChanged | 재사용이지만 동작 미검증 | 일부 동작 검증 | 모든 열거 의무 검증 | non-code 미검증 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Core | 525 | 2617 | 39 | 407 | 7 | 1 | 0 |
| Material | 189 | 936 | 54 | 3 | 0 | 0 | 2 |
| Cupertino | 44 | 160 | 34 | 0 | 0 | 0 | 2 |
| SDK | 76 | 268 | 0 | 0 | 0 | 0 | 11 |

동작 사례 **5개**가 **8개 module별 symbol 발생 항목**의 지정된 의무를 검사한다. 모든 열거 의무를 검사한 한 항목은 `sameKey`이며, 다른 class/함수·reexport까지 검증한 것으로 세지 않는다. 위 수치는 고유 기능 수·기능 완료율이 아니다.

### 남은 작업

P1의 기존 Widget/Element/State/GlobalKey/BuildContext/Inherited/parent-data 계약과 원래 생성자 이식, P2–P3의 전체 layout/scroll/gesture/editing/rich text/paint/custom hook·디자인·SDK API는 미완료다. 현재 runner의 기존 Widget import 거부를 호환 구현으로 바꾸지 않았다. 전체 선언 gate가 적절한 host 환경에서도 진단 없이 해석되는지와 각 원래 경로의 소비자/동작 사례도 남는다.

P4의 Android/Apple/Linux host·generation reload와 전체 package/API/platform 조합, process/GPU의 불투명한 peak 통제는 남는다. P5의 물리 IME/reader/trackpad·display/scanout·성능도 별도 수락이다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/display `notVerified`를 유지한다. npm 종료 원인은 미확정이며 아래의 과거 두 실패를 새 통과 기록으로 취소하지 않는다.

이후 구현·소스/공급 확인·기능/성능 gate를 이어받은 [work9](work9-summary.md)는 날짜별 요약으로 보관했다. 아래 Flutter 비교의 독립 작업 축과 P1–P5 미완료를 유지하고 API scope 축소·이름 alias·TS fallback으로 완료시키지 않는다.

## Flutter 엔진 C++ 비교

### 비교 기준과 판정

**2026-11-05 KST / HEAD `b2f18fc`**의 소스와 저장소의 [Flutter 엔진 소스](../../../../reference/flutter-master/engine/src/flutter)를 대조했다. 로컬 reference snapshot을 비교 기준으로 삼았으며, 최신 Flutter 배포판 또는 특정 engine commit과 전체 파일이 동일하다고 확인한 것은 아니다. 이 절은 당시 추가한 후속 소스 검토이며 위 구현·검증과 별도다. 원문의 이전 재검토 전체를 재수록한 것은 아니다.

Flutter의 Widget/Element/RenderObject layout·gesture·Material/Cupertino는 주로 Dart framework 책임이고, C++ engine은 저수준 graphics/text·scene 합성·runtime·embedder 연결을 담당한다. Nelyx v2가 layout/interaction 일부까지 C++로 소유하는 것은 책임 분배의 차이다. 기존 export의 missing/signatureChanged 수치를 Flutter C++ 기능 누락 수나 엔진 완료율로 환산하지 않는다. [Flutter 공식 구조 설명](https://docs.flutter.dev/resources/architectural-overview)

**주요 격차는 렌더링 표현력, preparation 사이의 변경 없는 자원 재사용, 디스플레이 주기에 맞춘 frame 일정이다.** 아래의 재준비·timer 경로는 소스로 확인한 비용/일정상의 위험이며, 실제 jank·FPS 저하나 성능 차이를 측정한 결과는 아니다. Flutter Web의 frame service는 Dart 구현으로, Web host 일정의 비교 자료로만 사용한다.

### 확인한 격차와 소스 근거

| 영역 | 현재 v2와 남은 범위 | Flutter 비교 근거 |
| --- | --- | --- |
| 변경 없는 자원 재사용·재그리기 | [Native ContentProvider](../../../../Nelyx/engine/platform/windows/skia_provider.hpp)의 `prepare`는 문서의 전체 노드를 순회해 Picture를 만들고 paragraph/image를 준비한다. 문단 측정 캐시는 같은 preparation 안에서 소비되며 다음 preparation으로 유지되지 않는다. 이미지도 `makeRasterImage` 경로를 다시 거친다. [Web provider](../../../../Nelyx/engine/render/canvaskit-web/provider.ts)도 scene 노드마다 새 Picture를 만들고 이미지를 준비한다. 두 renderer는 target 전체를 clear하며, 변경 없는 준비 결과의 세대 간 재사용·damage 기반 재그리기가 부족하다 | [RasterCache](../../../../reference/flutter-master/engine/src/flutter/flow/raster_cache.h), [DiffContext](../../../../reference/flutter-master/engine/src/flutter/flow/diff_context.h), [Rasterizer](../../../../reference/flutter-master/engine/src/flutter/shell/common/rasterizer.cc). Flutter의 부분 재그리기도 `supports_partial_repaint` 등 backend/surface 지원 조건을 따른다 |
| Frame 일정·시간 계측 | [Native host](../../../../Nelyx/engine/platform/windows/host.cpp)의 활성 clock은 16ms `wait_for`와 HWND timer, [Web RenderActor](../../../../Nelyx/engine/platform/web/actors.ts)는 `setTimeout`/`kick(16)` 중심이다. Refresh interval·vsync start/target에 맞춘 일정과 build/raster 단계별 시간 계약이 부족하다. 입력 wake는 대기를 깨울 수 있으므로 이를 고정 60 FPS 상한으로 해석하지 않는다 | [Windows OnVsync/FrameInterval](../../../../reference/flutter-master/engine/src/flutter/shell/platform/windows/flutter_windows_engine.cc), [FrameTimingsRecorder](../../../../reference/flutter-master/engine/src/flutter/flow/frame_timings.h). Web 비교 대상은 `requestAnimationFrame`을 쓰는 [frame service](../../../../reference/flutter-master/engine/src/flutter/lib/web_ui/lib/src/engine/frame_service.dart) |
| Canvas/Paint 표현력 | [GraphicsStyle/Affine](../../../../Nelyx/engine/core/scene/geometry.hpp)와 [Native graphics](../../../../Nelyx/engine/platform/windows/graphics.hpp)는 단색·path·stroke·shadow·blur·2D affine 중심이다. Gradient/shader, 다양한 blend/color filter, backdrop filter, stroke cap/join/miter 설정, perspective 등 일반 paint/custom rendering을 표현하는 v2 protocol/provider/public bridge가 부족하다. Skia/CanvasKit 자체의 기능 부재와 구분한다 | [DlPaint](../../../../reference/flutter-master/engine/src/flutter/display_list/dl_paint.h), [DlCanvas](../../../../reference/flutter-master/engine/src/flutter/display_list/dl_canvas.h)의 paint/filter·saveLayer·transform·draw 명령 계약 |
| Rich text·문단 설정 | [Native paragraphFor](../../../../Nelyx/engine/platform/windows/skia_provider.hpp)와 [Web paragraph 생성](../../../../Nelyx/engine/render/canvaskit-web/provider.ts)은 고정 font family 집합·단일 크기/색상/방향으로 텍스트를 넣는다. 입력 계약에 style span, run별 font weight/features/variations/locale, maxLines/ellipsis/strut, inline placeholder를 추가해야 RichText/WidgetSpan·복합 편집기의 범위를 넓힐 수 있다 | [ParagraphBuilder](../../../../reference/flutter-master/engine/src/flutter/lib/ui/text/paragraph_builder.h)의 style stack/placeholder, [TextStyle](../../../../reference/flutter-master/engine/src/flutter/txt/src/txt/text_style.h), [ParagraphStyle](../../../../reference/flutter-master/engine/src/flutter/txt/src/txt/paragraph_style.h) |
| 이미지·외부 콘텐츠 | 현재 provider와 [node 계약](../../../../Nelyx/engine/schema/protocol.json)은 정적 encoded image 중심이다. 애니메이션 이미지의 frame/duration/loop, 외부 texture 갱신, platform view 합성의 v2 계약이 부족하다. 영상·카메라·네이티브 뷰 연동에는 engine 계약과 각 platform/plugin 구현이 함께 필요하다 | [MultiFrameCodec](../../../../reference/flutter-master/engine/src/flutter/lib/ui/painting/multi_frame_codec.h), [TextureRegistry](../../../../reference/flutter-master/engine/src/flutter/common/graphics/texture.h), [ExternalViewEmbedder](../../../../reference/flutter-master/engine/src/flutter/flow/embedded_views.h) |
| 접근성 의미 정보 | UIA/DOM-ARIA 연결은 있지만 [semantics protocol](../../../../Nelyx/engine/schema/protocol.json)은 role 8종·flag 6종·action 6종이며 [SemanticData](../../../../Nelyx/engine/core/interaction/editing.hpp)는 label/hint 중심이다. 탐색·hit-test 순서의 별도 표현, scroll 정보, 문자열 속성, custom accessibility action, heading 등 의미 정보의 범위를 보강해야 한다 | [SemanticsNode](../../../../reference/flutter-master/engine/src/flutter/lib/ui/semantics/semantics_node.h)의 traversal/scroll·string attributes·custom action·heading 등의 payload |
| 실행 중 메모리 압박 대응 | [Ledger](../../../../Nelyx/engine/core/memory.hpp)의 예약·거부·회수는 있지만, OS pressure를 v2 host/content/render cache 축소로 연결하는 경로가 부족하다. [기존 SDK OS service](../../../../Nelyx/sdk/src/runtime/os-services.ts)에는 `memoryPressure` 통지가 있으므로 저장소 전체에 기능이 없다고 판정하지 않는다. Native의 `SkGraphics::PurgeAllCaches`는 현재 host 종료 경로다. 예약 예산을 전체 process/driver hard cap으로 확대하지 않는다 | [Shell low-memory 통지](../../../../reference/flutter-master/engine/src/flutter/shell/common/shell.cc)와 [Rasterizer cache 정리](../../../../reference/flutter-master/engine/src/flutter/shell/common/rasterizer.cc). 이 경로 역시 backend별 구현이며 Flutter의 process/GPU 전체 hard cap을 뜻하지 않는다 |
| Platform embedder·개발 수명 | [일반 v2 runner](../../../../Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)는 Windows/Web만 공급하며 Android/Apple/Linux host와 generation reload가 남는다. 이 항목은 Material/Cupertino 생성자 이식과 별도의 engine/platform 연결 작업이다 | Flutter의 [platform embedder](../../../../reference/flutter-master/engine/src/flutter/shell/platform)와 [공통 embedder API](../../../../reference/flutter-master/engine/src/flutter/shell/platform/embedder/embedder.h). Flutter의 reload는 Dart runtime/framework와 tooling도 함께 담당한다 |

이미 구현된 retained Picture 재생·layout 재사용, UTF-16/RTL/fallback·편집 geometry, Windows TSF/UIA와 Web DOM-ARIA, owner/ACK·snapshot 수명은 위 격차와 함께 보존한다. 특히 [Vulkan device](../../../../Nelyx/skia/native/platforms/vulkan/device.cpp)의 present mode는 이미 `VK_PRESENT_MODE_FIFO_KHR`다. GPU의 FIFO present와 구분하여 **frame 생성 일정의 display 연동을 보강한다.** FIFO present·raster 완료·publication도 물리 display/scanout 관측으로 세지 않는다.

### 후속 구현 순서와 완료 조건

기존 P1–P5/API gate를 대체하지 않고, 기능 호환과 체감 성능을 별도 축으로 진행한다. 작은 문서 변경에 따른 전체 콘텐츠 재준비는 Widget API 이식만으로 해결되지 않으므로 독립된 후속 작업으로 둔다.

| 작업 축 | 우선 작업 | 완료 조건과 증거 |
| --- | --- | --- |
| 기능 호환 | Canvas/Paint와 rich paragraph의 protocol/core/provider 계약을 넓힌 뒤 원래 공개 API를 연결 | Windows·Web 두 profile에서 같은 계약을 실행하고 paint pixel·clip/hit geometry·font/UTF-16/RTL/placeholder query corpus를 대조한다. 원래 constructor/import/동작 의무와 실제 ACK/native 작업을 검사하며 alias·TS fallback·타입 일치만으로 승인하지 않는다 |
| 체감 성능 1 | Preparation 사이에 변경 없는 Picture·paragraph·decoded image를 재사용 | Node/resource/style/font/layout revision과 metrics/device의 무효화 조건을 정의하고 기존 preparation/publication identity를 보존한다. 텍스트/이미지가 많은 장면의 작은 문서 변경에서 변경 없는 노드의 재기록·재layout·decode가 줄어드는지 실제 provider 작업 수로 확인한다. 교체·실패·취소·종료 시 이전 자원이 회수되는지도 검사한다 |
| 체감 성능 2 | Native vsync 기반 일정과 Web rAF 연동, frame 단계별 시간 계측 | Display 주기에 맞는 start/target/deadline과 idle/input wake 정책을 정하고, 실제 실행 경로의 build/content/raster 시간을 구분한다. 고주사율·연속 입력·resize를 같은 조건으로 측정한다. Counter·timer 호출·GPU 완료를 물리 display 또는 성능 수락으로 바꾸지 않는다 |
| 체감 성능 3 | 재사용·clock 측정 결과에 따라 raster cache와 damage/부분 재그리기 적용 | Cache admission/eviction·transform/opacity/clip·resize·backing 보존/무효화 조건을 검증한다. 부분 재그리기는 지원 backend에서 전체 재그리기와 pixel 결과가 같아야 하며 지원하지 않는 host의 정상 경로도 유지한다. 실제 입력 구간의 작업·시간과 실기기 조작/display 관측을 별도로 판정한다 |
| 제품 통합 | Animated codec·texture/platform view·semantics 확장·OS pressure 연결·남은 host/reload | 각 platform의 입력/접근성/외부 자원 수명과 pressure 시 cache 정리를 실제 소비 경로에서 확인한다. 신규 cache도 기존 ledger/owner 회수 정책에 포함하며 미지원·미관측 platform은 미완료로 남긴다 |

## npm 비정상 종료와 보완의 경계

Archive 소비자의 npm install 자식 프로세스가 과거 **두 번**, 출력 없이 **3221226505 = 0xC0000409**로 종료했다. 단독/전체 suite에서 모두 관측했고 정상 통과한 경우도 있었다. 예외 parameter·fault module/stack/dump를 확보하지 못했으므로 stack 손상·Node/npm 특정 결함·OOM을 원인으로 확정하지 않았다.

당시 npm entry 경로 표기 두 가지나 가용 메모리 한 시점만으로 원인을 판정하지 않는다. Engine의 384 MiB ledger는 외부 npm 프로세스를 측정/제어하지 않는다. TypeScript 실행 파일 경로 수정, Native stdout 레코드 경합, GUI hidden-start fixture 결함도 npm fast-fail과 별개다.

외부 consumer 자식에서 부모 npm lifecycle/workspace/test-channel 환경을 분리하고 각 bundle compiler를 finally에서 종료했다. Registry/auth/cache 설정 전체를 버리지 않았고 token/env 값·상시 dump/로그는 보관하지 않았다. 이후 일반 runner 전체8/8 기록은 보완된 fixture 통과이며 npm 근본 원인 해결이나 재발 방지 보장이 아니다.

## 7.3 재발할 경우의 한정된 조사

1. Source/supply 확인 뒤 일반 전체 suite를 한 번, 필요하면 같은 archive 사례를 단독 한 번 실행한다. Timeout은 **20분**으로 유지한다.
2. 자식 Node/npm real path·version·cwd·status/signal·출력 유무·당시 메모리와 필요한 env key의 존재를 확인한다. 값/token은 출력하지 않는다.
3. 재현될 때만 env와 compiler 수명을 각각 고정해 한 조건씩 소수 대조한다. 같은 status가 계속되면 가능한 WER/Event/임시 debugger에서 parameter·module·stack을 확인하고 미확보 시 원인 미확정을 유지한다.
4. 근거 뒤에만 Node/npm·fixture 변경을 하나씩 검증한다. Cache 전체 삭제/무차별 갱신·상시 dump를 첫 조치로 삼지 않는다. 소유 process/consumer/archive·임시 조사물은 finally로 정리한다.

## 최종 gate와 이월

| gate | 종료 시 판정 |
| --- | --- |
| 원래 API 표면·동작 | **FAIL / 미완료**. 원래 scope·overload/member/protected/non-code·원래 import와 동작 의무 유지 |
| 일반 runner·그래픽·메모리 | **Windows/Web 구간 통과 / 전체 PARTIAL**. 남은 host/reload·전체 API/package 조합·GPU 공통 corpus·불투명 peak 정책은 미완료 |
| npm | **fixture 보완 후 통과 / 근본 원인 미확정** |
| Native 성능·물리 입력/display | **notVerified / false**. 실제 일반 실행·실기기 입력과 display 관측을 별도로 요구 |

`performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 IME/reader/trackpad·display/scanout `notVerified`를 [work9](work9-summary.md)로 이월했다. 소스 비교·문서 검사나 자동 수치로 이 상태를 승격하지 않는다.
