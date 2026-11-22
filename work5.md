# W5 · Nelyx Android WebView 스크롤 개선 계획

**2026-11-22 · PAUSED / PARTIAL · 기준 브랜치 `tauri-backend` · 계획 기준 Nelyx `856b16ba`**

목표는 Demo의 **All components**에서 첫 플링, 연속 방향 전환, 하단 이미지까지의 왕복을 부드럽게 만드는 것이다. Pixel 5 에뮬레이터의 목표는 각 활성 이동 구간의 표시 간격 p95 **33.33ms 이내**, Galaxy는 **16.7ms 이내**이며 33.3ms 이상의 반복 끊김도 해소해야 한다. 제품 경로는 Tauri WebView의 CanvasKit WebGL2이며 WebView가 렌더러를 자동으로 선택한다. 스크롤 성능 인수는 하드웨어 GPU에서 진행한다. 슬라이더 추종, 실제 IME 연결, 접근성, 클리핑과 이미지 복구까지 인수 범위에 포함한다. [W4 종료 기록](work4.md)

시작 자산의 중복 이미지 디코딩을 제거했다. WebView 109에서 검증한 sRGB WebP는 브라우저가 디코딩한 픽셀을 CanvasKit에 직접 등록한다. [시작 자산 §9](#9-pixel-5에서-이미지-경로-구조-개선) · [Pixel 5 검증 §10](#10-구형-webview의-첫-이미지-디코딩)

기존 Pixel 5를 스냅샷 없이 재시작한 뒤 CSS 대조의 p95는 99.99ms에서 18.91ms로 줄었다. 재방문과 방향 전환은 33.33ms 목표를 통과한 구간이 있었고, 상단 첫 플링과 처음 보는 입력창으로 진입할 때의 긴 프레임은 남았다. [재시작과 관성 스크롤 §12](#12-기존-pixel-5-재시작과-관성-스크롤-재검증)

손을 뗀 뒤의 관성을 다시 추적했다. 편집기 초기화의 중복 작업을 줄인 후보는 중하단 첫 관성에서 일관된 개선을 보이지 않았고 이미지 접근에서 반복 회귀해 되돌렸다. [관성 표시 추적과 편집기 후보 §13](#13-관성-표시-추적과-편집기-후보)

**첫 구현 후보는 원본 크기 정지 이미지의 중복 표면 복사 제거다.** 실제 Demo 자산과 호출 경로를 특정할 수 있고 변경 범위가 디코딩된 한 프레임의 소유권으로 한정된다. 이 수정이 직접 영향을 주는 구간은 하단 이미지의 첫 노출이다. 상단 첫 플링과 편집기 첫 진입은 W4에서 관찰한 병목에 맞춰 각각 다룬다. §2는 계획 수립 시 확인한 구조 차이이고, §3의 변경 효과는 Nelyx 기준 APK와 후보 APK의 표시 간격으로 판정한다.

## 1. 출발점

| 정식 APK, 786×1602, 한 차례 왕복 | 첫 버퍼 표시 지연 | 버퍼 표시 간격 p95 | 33.3ms 이상 / 유효 간격 |
| --- | ---: | ---: | ---: |
| 상단 첫 플링 | 245.24ms | 435.30ms | 3/4 |
| 중하단 첫 플링 | 140.66ms | 87.17ms | 4/10 |
| 이미지 접근 마지막 스와이프 | 112.26ms | 68.59ms | 17/31 |
| 중하단 재방문 플링 | 117.23ms | 67.92ms | 7/14 |
| CSS 대조 | — | 20.52ms | 0/86 |

상단은 간격 표본이 4개라 이 실행의 p95가 최장값과 같다. W4 §28에서 작은 경로를 GPU 삼각형으로 그렸을 때 계측 실행의 상단 최장 `flush()`는 362.8 → 83.7ms였다. 프로브를 끈 세 쌍에서는 중하단 첫 플링 p95 중앙값이 87.11 → 182.73ms로 늘었다. 이 후보는 제외했다. 두 편집기의 유휴 준비도 필수 레이아웃 시간을 줄였지만 전체 왕복에서 회귀했다. 새 후보의 채택 기준은 실제 버퍼 표시와 입력이다. [W4 §27–28](work4.md#28-작은-경로의-webgl-직접-그리기)

## 2. Flutter 소스·문서와 대조한 설계 근거

Flutter Web Engine 문서는 CanvasKit 기본 빌드와 Chromium 최적화 빌드를 구분한다. 아래 비교에는 Nelyx의 위젯 이식 기준인 Flutter 커밋 `71e4717a`의 웹 엔진과 프레임워크 소스를 사용했다. 이 커밋의 DEPS는 Skia `3136abef`를 가리킨다. Nelyx는 Skia `61e7ca4e`에 paragraph·Picture·font 바인딩을 적용한 `m153-nelyx-paragraph.8`을 사용한다. Flutter 로더는 브라우저 기능과 설정에 따라 full·chromium·webparagraph 자산을 선택한다. 이 공급 차이를 감안해 Nelyx에는 프레임 소유권, 가시성 판정, 제출 순서에서 적용할 부분을 골랐다. [Flutter Web Engine 문서](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/README.md) [Nelyx 이식 기준](Nelyx/licenses/design-foundation-sources.json) · [Nelyx 런타임](Nelyx/skia/packages/web/native-manifest.json) · [Flutter DEPS](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/DEPS) · [Flutter 로더](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/flutter_js/src/canvaskit_loader.js)

| 경로 | Flutter에서 확인한 동작 | Nelyx에서 개선에 사용할 차이 |
| --- | --- | --- |
| 이미지 프레임 | CanvasKit 코덱은 현재 프레임의 `SkImage`를 이미지 객체로 감싼다. 브라우저의 `ImageBitmap`을 받은 GPU 경로는 지연 텍스처 업로드도 지원한다. [코덱](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/canvaskit/animated_image.dart) · [이미지 소스](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/canvaskit/renderer.dart#L253) | Demo는 `AssetImage('component-image')`를 사용한다. 현재 코덱은 목표 크기가 원본과 같아도 임시 `MakeSurface`에 다시 그려 스냅샷을 등록한다. 이 복사는 디코딩한 프레임마다 발생한다. [Demo](sample/nelyx-demo-app/src/image-demo.ts) · [코덱](Nelyx/skia/packages/web/src/library.ts) |
| 편집기와 목록 | Flutter의 입력 장식은 바깥·접두·접미 아이콘의 크기를 구하고 필요한 텍스트 슬롯에 baseline을 요청한다. Sliver는 자식이 paint 범위와 겹칠 때 그린다. [입력 장식](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/material/input_decorator.dart#L953) · [Sliver](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/rendering/sliver_multi_box_adaptor.dart#L692) | Nelyx도 Sliver paint 범위를 검사한다. 입력 장식의 공통 `measure`는 존재하는 각 슬롯의 크기와 baseline을 함께 구한다. 아이콘의 수직 중앙 배치와 컨테이너의 원점 배치에는 크기만 쓰인다. [Sliver](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts) · [장식 레이아웃](packages/material/src/internal/input/input-decorator-layout.ts) |
| Picture 재사용과 가시성 | 보존한 레이어를 트리에 다시 붙인다. Picture 기록 시 bounds 계산을 켜고, 프리롤에서 지역 경계를 구한 뒤 측정 단계에서 변환·클립을 적용한 캔버스의 `quickReject`를 사용한다. Flutter가 쓰는 Skia의 바인딩은 이 기록 옵션에 R-tree를 연결한다. [레이어 재사용](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/layer/layer_scene_builder.dart#L74) · [측정](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/layer/layer_visitor.dart#L419) · [기록 옵션](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/canvaskit/canvaskit_api.dart#L1561) · [Skia 바인딩](https://github.com/google/skia/blob/3136abef8f582a75e9a2791261be3fe5f2f770d1/modules/canvaskit/canvaskit_bindings.cpp#L2355) | Nelyx도 이동만 하는 레이어의 네이티브 Picture를 재사용한다. 프레임 Picture 기록 범위는 ±2²⁹이며 공간 인덱스를 끈다. 부모 클립에서 버튼 픽셀이 사라졌던 이력이 있다. `PictureLayer.canvasBounds`도 추정치다. 가시성 최적화에는 그림의 전체 출력을 포함한다고 보장할 수 있는 경계가 필요하다. [장면](Nelyx/src/ui/scene.ts) · [PictureLayer](Nelyx/src/framework/rendering/layer.ts) · [클리핑 회귀 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs) |
| 첫 경로 그리기 | `CkCanvas.drawArc`는 각도를 라디안에서 도로 변환해 CanvasKit의 `drawArc`에 넘긴다. [Flutter Canvas](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/canvaskit/canvas.dart#L98) | Nelyx는 일반 호를 유리 이차 곡선으로 기록해 `drawPath`로 보낸다. W4 §10에서 같은 호의 직접 그리기는 상단 링크 비용을 줄였고, 뒤쪽 스크롤에서 관련 프로그램이 처음 링크됐다. 이 결과에 따라 호 하나의 직접 그리기는 제외하고, W5-04에서 Nelyx 프로그램별 첫 사용 위치와 전체 경로의 비용을 판단한다. [Nelyx Canvas](Nelyx/src/ui/canvas.ts) · [W4 §10](work4.md#10-원형-진행-표시기의-첫-webgl-링크-비용) |
| 표시 표면과 프레임 대기 | 고정 소스의 Chromium 기본 경로는 하나의 오프스크린 GL 표면에 Picture를 그려 flush한 뒤, 지원 환경에서 `createImageBitmap`과 `transferFromImageBitmap`로 표시한다. Safari·Firefox 또는 강제 설정에서는 온스크린 다중 표면을 쓴다. CanvasKit의 `isMultiThreaded`는 false다. 뷰마다 처리 중인 장면과 교체 가능한 다음 장면을 둔다. [경로 선택](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/canvaskit/renderer.dart#L34) · [표면](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/canvaskit/surface.dart#L306) · [비트맵 표시](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/compositing/render_canvas.dart#L105) · [장면 교체](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/renderer.dart#L424) | Nelyx는 온스크린 WebGL2에 직접 재생하고 `surface.flush() → fenceSync() → gl.flush()` 순서로 제출한다. 호스트가 준비 프레임 하나를 보유하고 Web 렌더러는 완료 대기 중인 제출을 최대 두 개 허용한다. fence는 리소스 반환에도 쓰인다. Flutter의 장면 완료와 Nelyx의 GPU 리소스 반환은 서로 다른 시점이다. [Nelyx 제출과 반환](Nelyx/skia/packages/web/src/library.ts) · [호스트](Nelyx/src/hosting/runtime.ts) |

**이미지 소유권이 첫 수정의 근거다.** Flutter의 `Codec.getNextFrame` 계약에서는 호출자가 반환된 이미지를 해제한다. 고정 소스의 `CkAnimatedImage`는 현재 프레임의 핸들을 넘기고, 상위 `_SkiaEngineCodec`은 목표 폭이나 높이를 지정했을 때만 크기 조정 함수를 호출한다. Nelyx는 현재 스냅샷 복사로 코덱과 반환 이미지의 수명을 분리한다. 따라서 원본 크기 분기에서는 복사를 없애면서도 호출자가 코덱을 먼저 닫은 뒤 반환 이미지를 그릴 수 있어야 한다. [Flutter API 계약](https://api.flutter.dev/flutter/dart-ui/Codec/getNextFrame.html) · [Flutter 프레임 반환](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/primitives/codec.dart#L310) · [Nelyx 코덱](Nelyx/skia/packages/web/src/library.ts)

**화면 밖 그리기와 표시 표면의 우선순위는 다르다.** Nelyx에는 이미 Sliver의 가시 범위 검사와 Picture 재사용이 있으므로, 추가로 생략할 수 있는 단위는 그 검사를 통과한 Picture다. 반면 오프스크린 표면은 비트맵 생성과 전달 단계를 더한다. W4에서 확인한 상단 지연은 주로 첫 프로그램 링크 중에 발생했으므로, 표시 표면 교체는 Nelyx에서 제출 후 지연이 확인될 때만 시도한다.

## 3. Nelyx 구현 순서와 판정

### W5-01 · 하단 이미지의 원본 크기 복사 제거

- [x] `component-image.webp`는 **960×1440, 단일 프레임, 109,750바이트**다. Demo의 720×220은 위젯 배치 크기다. 원본 크기로 디코딩할 때 RGBA 한 장은 약 5.27MiB다. `getNextFrame`에서 실제 목표 크기, 임시 표면 수, 디코드·스냅샷 시간, 첫 텍스처 업로드를 기록하고 이미지가 처음 보이는 프레임에 맞춘다. [크기 결정](Nelyx/src/hosting/images.ts) · [자산](sample/nelyx-demo-app/assets/component-image.webp)
- [x] 단일 프레임이고 목표 크기가 원본과 같을 때 디코딩된 이미지를 직접 등록하는 후보를 검증한다. 코덱이 보유한 이미지와 호출자에게 반환한 프레임의 소유권을 명시한다. `makeImageAtCurrentFrame()`에서 얻은 핸들과 코덱 소유의 `still`을 각각 다루고, 반복 호출·실패·선행 코덱 해제·마지막 lease 반환에서 각 핸들을 한 번만 해제한다. 기존 리사이즈와 애니메이션의 크기·순서·지연 및 바이트 예산을 검증한다. [후보 제외 기록](#w5-01--정지-이미지-직접-등록-후보-제외)
- [x] 지원하는 대형 불투명 WebP에서 브라우저가 디코딩한 sRGB 픽셀을 직접 등록한다. 임시 표면은 한 번에서 0회로 줄였다. 최초 업로드, 색 추출, WebGL 손실 후 복구 및 재진입 픽셀을 검증했다. [Pixel 5 검증](#10-구형-webview의-첫-이미지-디코딩)
- [ ] 투명 이미지와 다른 색 공간의 기기 회귀, 빠른 왕복에서 메모리, 첫 이미지 진입의 표시 p95를 인수한다.
- [x] Demo의 시작 자산에서 `AssetImage`로 요청하는 WebP의 중복 디코딩을 제거했다. [Pixel 5 실행](#9-pixel-5에서-이미지-경로-구조-개선)

### W5-02 · 중하단 첫 입력창의 필수 작업 줄이기

- [x] W4 §27의 `Write something` 첫 진입에서 섹션 생성, 입력 장식의 dry/실제 레이아웃, 슬롯별 baseline 조회와 문단 배치를 같은 프레임으로 대응시킨다. 입력창 두 개의 실제 슬롯 구성을 기록한다. 이 Demo의 기본 입력창에는 아이콘이 없는 경우가 있어, 아이콘 전용 개선은 해당 실행의 이득으로 계산할 수 없다. [Demo 편집기](sample/nelyx-demo-app/src/components.ts) · [장식 구성](packages/material/src/input-decorator.ts)
- [x] baseline을 읽지 않는 아이콘·컨테이너 슬롯은 크기만 계산하도록 장식의 내부 측정을 바꾼다. 입력·힌트·라벨·보조문구·카운터에서 위치 계산에 쓰는 baseline은 유지한다. 슬롯별 비용이 작고 생성이 지배적이면 첫 마운트의 중복 장식 구성이나 동일 제약의 문단 계산을 호출 스택에서 특정해 그 연산만 제거한다. 위젯 생성·빌드·콜백 순서와 편집기 연결 시점을 보존한다.
- [x] RTL, 글자 배율 변경, 단일·여러 줄, 오류·떠 있는 라벨의 크기와 위치, 포커스·한글 조합·선택 좌표를 확인한다. 중하단 첫 플링과 재방문에서 생성 수, 레이아웃 시간, 표시 간격을 함께 비교한다. [실행 기록](#5-2026-11-21-pixel-5-실행-기록)

### W5-03 · 재방문 때 화면 밖 Picture 재생 줄이기

- [x] 재방문에서 같은 Picture의 기록·컴파일·재생 횟수와 변환, 유효 클립, 실제 그리기 비용을 관찰한다. 이미 Sliver에서 제외한 자식을 빼고, **제출되는 Picture 중 확실하게 화면 밖인 것**이 얼마나 남는지 계산한다. W4 §20에서 이동 그림의 연속 소수 픽셀 위치 일치는 0회였다. 기존 SkPicture 재사용을 출발점으로 삼는다. [W4 §20](work4.md#20-이동하는-picture의-래스터-재사용-조건)
- [ ] 제외할 작업이 확인되면 불변 Picture와 함께 보수적인 지역 경계를 한 번 보관하고, 재생 시 현재 변환·클립으로 완전히 벗어나는 경우만 건너뛴다. 처음에는 유한 경계와 축 정렬 이동을 증명할 수 있는 잎에 적용한다. 그림자·필터·backdrop·역채움·원근·알 수 없는 경계는 원래대로 재생한다. 상태 명령과 리소스 수명은 유지하고, 역스크롤 때는 가시성을 다시 판정한다.
- [ ] DPR 1·2, 부분 노출 버튼, 소수 좌표, 중첩 클립과 역방향에서 기준 픽셀을 대조한다. 회피한 draw 수, 경계 계산 시간, `native-replay`, 표시 p95를 함께 잰다. 화면 밖 재생이 드물면 이 단계는 조사 결과로 닫는다.

### W5-04 · 첫 링크와 표시 지연의 원인에 맞춰 제출 경로 선택

- [x] 상단에서 입력 수신, 장면 준비, 프로그램별 최초 링크, native flush, fence 삽입·반환과 첫 버퍼 표시를 시간순으로 맞춘다. Ganesh의 GL flush는 조건부다. 프레임별로 실제 GL flush 호출 위치·횟수와 소요 시간을 확인한다. GPU 대기 중 새 입력이 온 경우에는 준비 프레임의 입력 번호가 실제 제출 때 얼마나 오래됐는지도 기록한다. [Nelyx 프레임 진단](Nelyx/src/ui/frame-diagnostics.ts) · [Flutter의 표면별 제출](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/compositing/offscreen_canvas_rasterizer.dart#L73)
- [ ] **명령 선택이 원인이면** Nelyx 계측에서 같은 프로그램을 처음 사용하는 카드와 이후 재사용하는 카드를 묶어 의미가 동등한 GPU 프리미티브를 선택한다. 새 프로그램이 처음 필요한 다음 카드까지 추적한다. W4에서 회귀한 호 하나의 교체, 시작 시 일괄 워밍업, 작은 경로 전체의 렌더러 전환은 기존 대조 결과로 사용한다.
- [ ] **제출 후 표시 대기가 지배적이면** 동일한 Nelyx 장면으로 온스크린 직접 제출과 단일 오프스크린 WebGL2 → ImageBitmap → 표시 캔버스를 비교한다. 지원 여부를 확인하고, 동시에 보유하는 비트맵·대기 장면 수를 제한한다. 늦게 도착한 이전 크기·세대의 비트맵, 뷰 종료, context loss, 소비 전 교체 시 해제를 검증한다. 비트맵 생성·전달 비용을 포함한 표시 지연이 줄 때만 제품 후보로 삼는다. 중복 flush가 실제 병목일 때에는 별도 후보에서 fence 전후 명령 순서와 GPU 완료 후 lease 반환을 검증한다. [Flutter 표시 경로](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/compositing/offscreen_canvas_rasterizer.dart#L73) · [브라우저 프레임 콜백](Nelyx/sdk/src/backends/browser/services.ts)

## 4. 인수와 종료

- [ ] Nelyx 제품 후보는 한 가지씩 기준 APK와 번갈아 세 쌍 비교한다. WebView 버전, 하드웨어 WebGL2 렌더러, 래스터 크기와 접근성 설정을 맞춘다. 에뮬레이터에서는 Android 합성기도 호스트 GPU에 연결됐는지 확인한다. 같은 제스처 후에도 이동 거리가 달라질 수 있으므로 구간별 시작·종료 카드도 확인한다. 새 프로세스의 첫 방문과 같은 프로세스의 재방문을 나눈다. W4의 11개 구간에서 첫 버퍼 지연, 간격 표본 수, p95·p99·최장, 33.3ms 이상 횟수를 기록한다. 앱 내부 프로브는 원인 분석 실행에서 켠다. 효과 판정은 프로브를 끄고 Perfetto로 수행한다. CSS 대조도 함께 흔들리거나 표본이 희박하면 해당 비교의 한계를 남긴다.
- [ ] Pixel 5는 각 활성 이동 구간 p95 ≤ 33.33ms를 확인한다. Galaxy는 동일 기기·WebView·주사율·화면에서 기준과 비교해 p95 ≤ 16.7ms와 반복 끊김 해소를 확인하고, 실제 손가락으로 범위 손잡이와 방향 전환을 확인한다. 일부 단계만 빨라지고 다른 구간의 표시나 입력이 반복 악화되면 해당 후보를 되돌린다.
- [x] 단일·범위 슬라이더의 느린 이동, 방향 전환, 취소 뒤 재드래그, 트랙에서 시작한 세로 스크롤, IME `804` 입력과 복귀, 로컬 이미지의 컨텍스트 복구, 접근성 값·화면 위치, 클리핑 픽셀을 확인한다. 기능 검사는 WebView가 선택한 렌더러에서 진행한다. 성능 비교는 하드웨어 GPU와 같은 래스터 해상도 및 콘텐츠를 요구한다.
- [ ] 후보별 변경 파일과 APK·PWA·런타임 식별값, 결과와 채택 여부를 이 문서에 갱신한다. 기기 또는 실제 입력 확인이 남으면 `PARTIAL`로 기록한다. 자동 검사 제한은 각 20분이며 임시 추적과 시험 산출물은 실행 종료 시 정리한다.

Nelyx 재현은 아래 명령을 사용한다. Android SDK·JDK와 네이티브 Trace Processor 준비 및 변경한 패키지를 러너에 공급하는 순서는 [W4 재현 절차](work4.md#4-재현과-검증-경로)를 따른다.

`--cpu`는 CPU 구간과 CanvasKit 호출의 계측을 켠다. 표시 성능은 프로브를 끈 `--timeline` 실행으로 확인한다.

```powershell
npm.cmd run build:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
$env:NELYX_TRACE_PROCESSOR = (Get-Command trace_processor_shell.exe -ErrorAction Stop).Source
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline --inertia
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline --image-entry-only
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline --inertia --image-entry-only
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline --editor-entry-only
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --cpu --timeline --editor-entry-only
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --cpu --controls=image
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --cpu --timeline --top-only
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --pictures
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --controls
```

## 5. 2026-11-21 Pixel 5 실행 기록

Pixel 5 API 33 x86_64의 WebView는 `109.0.5414.123`이었다. Android 합성기는 NVIDIA 호스트 GPU에 연결됐고, 인수 비교의 WebView는 WebGL2와 786×1602 래스터를 사용했다. 기준 PWA는 `e14edb01d1101cbdc8195d9db781f33365e7d25751c98c9d46712c93b07ae9d8`다. CanvasKit은 `m153-nelyx-paragraph.8`, WASM SHA-256은 `394e8db544128795c53f4e7a74d6a0f606d4f09e2b6351ff323e4f429afb834f`다. W4의 SwiftShader 기록은 병목을 찾는 데 참고했다. [런타임 매니페스트](Nelyx/skia/packages/web/native-manifest.json) · [W4 GPU 비교](work4.md#에뮬레이터-gpu-모드-비교)

### W5-01 · 정지 이미지 직접 등록 후보 제외

960×1440 WebP를 CanvasKit 애니메이션 디코더가 단일 프레임으로 반환했다. 후보는 이 이미지 핸들을 프레임에 넘기고, 일반 디코더의 `still`은 코덱과 각 프레임이 공유하게 했다. 독립 실행에서 선행 코덱 해제, 두 프레임의 마지막 lease 반환, 크기 조정 실패 뒤 원본 해제, 애니메이션의 70·130ms 지연과 반복 순서, 이미지 바이트 예산을 확인했다. 투명 Display-P3 픽셀의 sRGB 변환 오차는 채널당 2 이내였다. Demo WebP는 원본과 기존 복사본의 sRGB RGBA 5,529,600바이트가 일치했다. [이미지 코덱 경로](Nelyx/skia/packages/web/src/library.ts) · [Skia 프레임 소유권](https://github.com/google/skia/blob/61e7ca4e99062cdd0ab69445d5963fb3365778f6/src/android/SkAnimatedImage.cpp)

WebView 계측을 켠 별도 왕복에서는 프레임마다 만들던 임시 표면이 1회에서 0회로 줄었다. 기준의 `MakeSurface`와 스냅샷은 3.5ms와 2.1ms, 최초 크기 일치 텍스처 업로드 호출은 4.7 → 3.2ms였다. 디코더 생성은 29.7 → 41.7ms였다. 양쪽에서 등록된 이미지 바이트는 5,529,600이었으며, 이 값은 WASM 힙의 최고 사용량과 별개다.

| 비교 APK | APK SHA-256 | WebView PWA 빌드 ID |
| --- | --- | --- |
| W4 기준 | `7e38a34a80ebff903c8b42a942dfce53c1f2925c0d9a81e23a863769a9cb9d82` | `e14edb01d1101cbdc8195d9db781f33365e7d25751c98c9d46712c93b07ae9d8` |
| W5-01 | `7e104cc2deb76c36d62db12354b31a2e71eca8ae696d0fe75b23b2504d0f9d4e` | `335d60df4544614fa0fdbf77f4d300b98cd2612945ee6ebb49d23055eaa9e6e6` |

같은 기기에 APK를 번갈아 설치하고 앱을 껐다 켜서 프로브를 끈 세 쌍을 비교했다. 첫 버퍼 지연과 백분위는 세 실행의 중앙값이고, 최장과 33.3ms 이상 횟수는 세 실행 전체에서 구했다. 첫 플링의 단일 실행에서 기준의 유효 간격은 4–8개였다. 편집기나 이미지가 처음 진입하는 스와이프는 이동거리에 따라 달라졌다. 두 번째와 세 번째 쌍의 마지막 이미지 스와이프에서는 양쪽 모두 이미지 카드를 보면서 시작하고 끝났다.

| 동작 | 첫 버퍼 지연 (ms) | p95 (ms) | p99 (ms) | 최장 (ms) | 33.3ms 이상 / 유효 간격 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 상단 첫 플링 | 245.95 → 204.72 | 98.75 → 81.95 | 98.75 → 81.95 | 101.87 → 99.69 | 7/16 → 6/46 |
| 중단 방향 전환 | 56.35 → 51.61 | 19.92 → 19.54 | 20.31 → 28.39 | 26.57 → 35.06 | 0/90 → 1/86 |
| 중하단 첫 플링 | 73.42 → 85.42 | 49.99 → 51.63 | 83.91 → 82.56 | 99.65 → 98.62 | 6/63 → 8/71 |
| 하단 방향 전환 | 57.67 → 54.10 | 20.37 → 34.24 | 29.57 → 34.57 | 35.81 → 79.64 | 1/87 → 4/80 |
| 이미지 접근 1 | 95.91 → 108.92 | 19.15 → 19.79 | 22.65 → 32.51 | 32.16 → 52.31 | 0/207 → 2/193 |
| 이미지 접근 2 | 93.12 → 100.13 | 29.82 → 35.07 | 34.41 → 50.33 | 49.01 → 50.71 | 5/190 → 11/172 |
| 이미지 접근 3 | 110.12 → 120.35 | 38.69 → 38.33 | 57.47 → 50.05 | 57.64 → 50.16 | 17/166 → 19/155 |
| 이미지 접근 4 | 109.05 → 126.95 | 34.41 → 37.41 | 36.09 → 51.49 | 49.52 → 82.24 | 13/178 → 19/151 |
| 중하단 재방문 플링 | 98.91 → 111.75 | 22.31 → 20.84 | 32.27 → 33.97 | 38.23 → 36.80 | 1/98 → 3/89 |
| 하단 재방문 방향 전환 | 52.97 → 80.27 | 18.93 → 20.41 | 21.39 → 32.56 | 33.91 → 35.49 | 1/90 → 2/83 |
| CSS 대조 | — | 18.73 → 19.15 | 20.20 → 20.18 | 21.68 → 29.27 | 0/267 → 0/268 |

마지막 이미지 스와이프의 p95는 쌍별로 30.87 → 35.44ms, 34.41 → 47.65ms, 35.21 → 37.41ms였다. CSS 대조는 여섯 실행 모두 33.3ms 이상 간격이 없었다. §4 기준에 따라 코덱 변경을 되돌렸다. 후보 APK의 별도 Android 기능 검사에서는 색 추출과 WebGL 복구, 이미지 카드 재진입이 통과했다. 실제 화면의 주황색 픽셀 수는 복구 전·후와 재진입에서 모두 222,809개였다.

### W5-02 · 입력 장식의 첫 빌드와 슬롯 측정

`AnimationController.value`는 같은 값을 넣어도 리스너를 부른다. 입력 장식이 처음 의존성을 읽을 때 `floating`과 `hint` 값을 설정하면 두 리스너가 이미 붙어 있어 첫 빌드 뒤의 장식 재빌드가 예약됐다. 후보는 초기값을 설정한 뒤 장식의 리스너를 붙였다. 이후 위젯 상태나 포커스가 바뀔 때의 애니메이션 구독과 편집기 연결 시점은 기존 흐름을 따른다. [입력 장식 초기화](packages/material/src/input-decorator.ts) · [애니메이션 값 설정](Nelyx/src/framework/animation/animation-controller.ts)

장식 레이아웃에서 상하 중앙에 놓는 외부·접두·접미 아이콘과 원점에 놓는 컨테이너는 크기만 측정한다. 라벨·힌트·입력·보조문구·카운터와 문자열 접두·접미 슬롯은 baseline을 사용한다. 기본 Demo 편집기 두 개에는 아이콘이 없어서, 이 경로에서 생략되는 baseline 조회는 컨테이너에 해당한다. 독립 검사에서 크기 전용 슬롯이 baseline을 요청하면 실패하게 했고, 양방향 배치, 글자 배율에 따른 크기 변경, 한 줄·여러 줄 높이, 오류 영역과 떠 있는 라벨의 위치를 확인했다. [슬롯 측정](packages/material/src/internal/input/input-decorator-layout.ts) · [레이아웃 검사](packages/material/eng/check-input-decoration-layout.mjs)

계측을 켠 왕복에서 **Write something**은 하단 방향 전환의 프레임 797에 들어왔다. 섹션 생성 61.4ms와 실측 18.8ms가 같은 프레임에 있었다. 이 실행의 새 편집기 프레임에서는 dry 조회가 관측되지 않았다.

| 편집기 | 실제 레이아웃 슬롯 | 슬롯별 baseline 조회 합계 | 컨테이너 크기 측정 |
| --- | --- | ---: | ---: |
| Write something | 카운터, 보조문구, 라벨, 입력, 힌트, 컨테이너 | 1.9ms | 0.2ms |
| Your message | 오류 문구, 라벨, 입력, 컨테이너 | 0.3ms | 0.1ms |

Write something의 입력 슬롯 크기 측정은 5.4ms였다. 초기 진입에서는 섹션 생성이 가장 긴 작업이었다. 기존 기준 APK의 별도 실행에서 섹션 18의 생성과 실측은 51.4ms와 14.4ms였으며, 스크롤 시작 위치와 진입 구간이 달랐다. 이 두 계측만으로 편집기 생성이 빨라졌다고 판정할 수 없다. [프레임 진단](Nelyx/src/ui/frame-diagnostics.ts)

입력 장식 APK의 SHA-256은 `e5787a0095b0138d76719483353e5f4e10d3a2644fe0e3e06d0ac10308b39461`, PWA 빌드 ID는 `dc13fd92a35b27f5a878ef6201bc6ff2910c6b81694fbdd05743a247aeb99e12`다. W5-01을 되돌린 뒤 기준 APK를 재빌드했고 §5의 원래 해시와 일치했다.

프로브를 끈 세 쌍을 아래에 기록했다. 처음 시도한 세 번째 쌍은 후보가 이미지에 도달하지 못했다. 이 기기의 Android 뒤로가기 영역은 좌측 82px까지였다. 양쪽에 동일하게 쓰던 스와이프 시작점을 물리 좌표 `x=70`에서 `x=96`으로 바꿔 새 세 번째 쌍을 실행했다. 이 쌍은 11개 구간을 모두 수집했으나 CSS p95가 양쪽에서 87.14·45.32ms로 흔들렸다. 아래 중앙값에는 이 쌍이 포함된다. 표를 후보의 효과 판정에 사용할 때 화면 위치와 CSS 대조의 변동을 함께 고려해야 한다. [Android 제스처 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

| 동작 | 첫 버퍼 지연 (ms) | p95 (ms) | p99 (ms) | 최장 (ms) | 33.3ms 이상 / 유효 간격 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 상단 첫 플링 | 239.94 → 249.57 | 85.41 → 99.37 | 85.41 → 99.37 | 99.14 → 149.93 | 10/14 → 9/13 |
| 중단 방향 전환 | 62.28 → 74.96 | 33.23 → 53.95 | 33.38 → 53.95 | 63.50 → 81.77 | 10/67 → 12/55 |
| 중하단 첫 플링 | 134.84 → 78.63 | 84.79 → 49.69 | 84.79 → 83.10 | 101.82 → 117.84 | 14/32 → 14/39 |
| 하단 방향 전환 | 67.24 → 77.46 | 34.82 → 32.82 | 35.44 → 36.24 | 58.09 → 67.78 | 14/63 → 9/63 |
| 이미지 접근 1 | 152.46 → 127.45 | 34.02 → 34.28 | 53.05 → 62.77 | 63.45 → 65.43 | 24/142 → 25/143 |
| 이미지 접근 2 | 110.11 → 135.35 | 35.60 → 52.99 | 51.72 → 63.73 | 64.51 → 65.85 | 30/140 → 28/122 |
| 이미지 접근 3 | 141.25 → 158.89 | 49.86 → 51.03 | 68.85 → 60.99 | 76.27 → 77.76 | 39/106 → 36/107 |
| 이미지 접근 4 | 179.37 → 173.33 | 48.45 → 44.91 | 65.14 → 66.97 | 78.47 → 71.25 | 38/103 → 34/108 |
| 중하단 재방문 플링 | 81.39 → 127.66 | 55.73 → 51.74 | 55.73 → 51.74 | 62.41 → 52.97 | 10/47 → 16/41 |
| 하단 재방문 방향 전환 | 66.45 → 75.39 | 33.59 → 31.97 | 43.53 → 34.02 | 52.28 → 52.83 | 10/63 → 11/70 |
| CSS 대조 | — | 23.04 → 20.75 | 33.62 → 33.86 | 214.89 → 56.53 | 24/218 → 18/224 |

처음 두 쌍의 중하단 첫 플링은 84.79 → 83.10ms, 101.82 → 49.69ms였다. 두 쌍 모두 기준과 후보의 종료 카드가 달랐다. 같은 상단 카드로 시작하고 끝난 첫 플링은 82.22 → 99.37ms, 99.14 → 149.93ms였고 실행당 유효 간격은 4–5개였다. Pixel 5의 전 구간 p95 33.33ms 목표는 달성하지 못했다.

### W5-03 · 화면 밖 Picture 재생 조사

CanvasKit을 열 때만 적용하는 프로브로 Picture 컴파일과 실제 화면 표면의 재생을 집계했다. 원래 재생은 그대로 수행했다. 이동만 적용한 사각형·둥근 사각형·이미지의 출력을 한정하고, 저장 레이어·경로·문단·효과를 포함해 경계를 증명할 수 없는 Picture는 집계에서 미확정으로 분류했다. 단일 클립에서 60.5px 평행 이동한 사각형을 재생해 가시 항목 1개와 완전히 벗어난 항목 1개를 구별했다. [Picture 프로브](sample/nelyx-demo-app/eng/gallery-picture-probe.mjs)

| 재방문 구간, 786×1702 계측 래스터 | 새 컴파일 | 재생 / 서로 다른 Picture | 경계를 증명한 재생 | native-replay p95 |
| --- | ---: | ---: | ---: | ---: |
| 중하단 플링 | 2 | 63 / 20 | 0 | 7.0ms |
| 하단 방향 전환 | 3 | 110 / 20 | 0 | 23.9ms |

두 재방문 구간은 같은 Picture를 여러 번 재사용했다. 관측한 재생은 모두 현재의 보수적인 가지치기 조건 밖에 있어 건너뛸 대상을 입증하지 못했다. 프로브의 래스터는 새로고침으로 달라져 이 표는 표시 성능 인수에 사용하지 않았다.

재부팅 뒤 `x=96`으로 진행한 786×1602 계측에서도 두 구간의 재생 247회와 220회 중 단순 경계를 증명할 수 있던 경우는 0이었다. Picture는 각각 22개와 20개였으며 새 컴파일은 7회와 3회였다. 화면 재생의 표본에서는 2배 좌표 변환과 786×1602 기기 클립을 관측했다. 이 실행의 `native-replay` p95는 각각 3.7ms와 4.0ms였다.

### W5-04 · 첫 링크와 제출 뒤 표시 대기

786×1602에서 첫 플링의 CanvasKit과 Android FrameTimeline을 같은 시간축에 맞췄다. 경과 시간은 Android 터치 시작을 기준으로 한다.

| 관측 | 경과 |
| --- | ---: |
| 첫 입력 처리 시작 | 8.4ms |
| 첫 제출 진입 | 77.4ms |
| 첫 GPU 펜스 삽입 | 81.1ms |
| 후속 프레임의 동기 CanvasKit flush 시작 | 108.7ms |
| 첫 버퍼 표시 | 135.8ms |
| 후속 프레임의 동기 CanvasKit flush 종료 | 285.4ms |
| 첫 펜스의 완료를 폴링에서 관측 | 354.9ms |

첫 펜스에서 첫 표시까지 약 54.7ms가 지났다. 첫 표시는 후속 동기 제출이 진행되는 동안 관측됐고, 그 제출은 네 프로그램을 처음 링크하며 176.7ms를 썼다. 이 중 링크 상태 조회는 121.1ms였다. 별도 전체 왕복에서 같은 네 프로그램의 첫 링크를 포함한 가장 긴 제출은 79.7ms, 링크 상태 조회는 53.8ms였다. 첫 플링에서 Ganesh 내부 `gl.flush()`는 네 제출 중 1–2회, 펜스 뒤 `gl.flush()`는 네 번 모두 호출됐다. 각 실제 GL flush 호출의 최장 시간은 두 실행을 통틀어 1.0ms였다. 제출된 프레임의 입력 번호가 이미 처리한 입력 번호보다 뒤처지는 사례는 관측하지 못했다.

첫 버퍼가 나오기까지의 선행 작업과 후속 프레임의 동기 링크가 남아 있다. 표시 표면 교체로 줄일 수 있는 대기가 지배적이라는 근거가 없어서 오프스크린 비트맵 경로를 제품 후보로 만들지 않았다. 네 프로그램의 최초 사용은 **Progress indicators**와 **Cards**에 진입한 스와이프에 있었다. 동일 프로세스에서 이 네 프로그램이 중단 방향 전환 때 각각 14·14·63·1회, 중하단 재방문 플링 때 16·16·16·22회 선택됐다. 기존 호 한 개의 치환과 작은 경로 일괄 변경은 다음 구간으로 비용을 옮기거나 전체 왕복에서 회귀했다. [W4 호 대조](work4.md#10-원형-진행-표시기의-첫-webgl-링크-비용) · [W4 작은 경로 대조](work4.md#28-작은-경로의-webgl-직접-그리기)

## 6. 기능 검증과 남은 인수

입력 장식의 중복 빌드와 baseline 조회를 제거한 APK를 Pixel 5 에뮬레이터에 설치했다. `--controls`에서 다음 네 검사가 통과했다.

| 검사 | 관측 |
| --- | --- |
| 단일 슬라이더 | 트랙의 세로 이동에서 30 유지. 탭 후 느린 드래그 40, 방향 전환 70, 취소 20, 재드래그 60 |
| 범위 슬라이더 | 느린 드래그 32/75, 방향 전환 32/68.5, 취소 후 재드래그 34/68.5. 손잡이와 트랙에서 시작한 세로 이동에서 값 유지 |
| 편집기 | Android 소프트 키보드가 표시된 상태에서 `804` 입력. 키보드를 닫은 뒤 WebView DevTools로 `ㅎ → 하 → 한` 조합 및 확정. 터치는 커서를 UTF-16 오프셋 0과 17에 놓았고 편집기 전환 높이는 48 → 24 CSS px |
| 로컬 이미지 | 색상 팔레트 두 개 추출. WebGL 복구 전·후와 카드 재진입에서 주황색 픽셀 222,809개로 일치 |

Chromium DPR 1·2에서 버튼이 부분 노출된 양쪽 스크롤 경계와 역방향의 픽셀 검사가 통과했다. Demo 러너 타입 검사, Core 섹션 준비와 인계, Material 범위 슬라이더의 RTL 접근성 좌표, 입력 장식 레이아웃, WebGL 셰이더 링크 검증이 통과했다. [클리핑 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs) · [범위 슬라이더 검사](packages/material/eng/check-range-slider-hover.mjs)

표준 Android 실행 명령으로 `emulator-5554`에 다시 설치했다. 설치된 APK 해시와 실행 중인 WebView의 PWA 빌드 ID가 §5의 입력 장식 APK와 일치했고, 786×1602 WebGL2 화면에 첫 **Filled** 버튼이 표시됐다.

재부팅 뒤 같은 APK의 786×1602 WebGL2 화면에서 프로브 없이 왕복했다. 마지막 이미지까지 이동한 뒤 첫 카드로 돌아왔다. Android 디스플레이 주기는 16.67ms였으나, 웹 CSS 대조의 표시 p95는 46.51ms였고 44개 유효 간격 중 19개가 33.3ms 이상이었다. 이 실행은 전체 동작의 성능 목표가 확인되지 않은 기록이다.

| 최종 재검사 | 첫 버퍼 지연 (ms) | p95 (ms) | p99 (ms) | 최장 (ms) | 33.3ms 이상 / 유효 간격 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 상단 첫 플링 | 256.53 | 298.98 | 298.98 | 298.98 | 4/6 |
| 중단 방향 전환 | 70.53 | 57.83 | 57.83 | 57.83 | 7/12 |
| 중하단 첫 플링 | 103.36 | 53.73 | 53.73 | 53.73 | 5/8 |
| 하단 방향 전환 | 99.69 | 48.86 | 48.86 | 48.86 | 7/12 |
| 이미지 접근 1 | 103.20 | 50.59 | 53.79 | 53.79 | 19/30 |
| 이미지 접근 2 | 115.15 | 49.10 | 64.20 | 64.20 | 20/29 |
| 이미지 접근 3 | 92.85 | 70.64 | 74.91 | 74.91 | 18/22 |
| 이미지 접근 4 | 143.42 | 69.64 | 87.76 | 87.76 | 20/22 |
| 중하단 재방문 플링 | 69.42 | 52.33 | 52.33 | 52.33 | 7/10 |
| 하단 재방문 방향 전환 | 86.17 | 56.33 | 56.33 | 56.33 | 7/12 |
| CSS 대조 | — | 46.51 | 51.56 | 51.56 | 19/44 |

표시 성능은 `PARTIAL`이다. 테스트한 APK에는 기능 검증을 통과한 입력 장식 변경을 반영했다. 에뮬레이터 비교에서는 전체 스크롤 표시 속도의 개선을 확정하지 못했다. 에뮬레이터의 활성 이동 p95 33.33ms, Galaxy 동일 조건의 p95 16.7ms 및 실제 손가락 입력이 인수에 남아 있다. [Perfetto FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline)

## 7. Galaxy에서 관성 스크롤 확인

Galaxy SM-S931N에서 원래 경로와 FPS 기준을 유지했다. 기기는 Android API 37, arm64-v8a, WebView 157.0.8103.50이다. 화면은 1080×2340이며 WebView 360×780 CSS px, DPR 3, CanvasKit 720×1460 WebGL2, Adreno 830이다. 갤러리 이동 중 표시 주기는 약 8.33ms였다. FrameTimeline에서 앱의 VRI 레이어와 창 레이어를 확인하고 SurfaceFlinger의 표시 토큰과 연결했다.

```powershell
adb devices -l
$env:ANDROID_SERIAL = '<Galaxy serial>'
npm.cmd run build:android --workspace @nelyx/demo -- --architecture arm64
npm.cmd run run:android --workspace @nelyx/demo -- --device $env:ANDROID_SERIAL
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline --inertia
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --cpu --timeline --inertia
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --controls
```

Galaxy 기준은 §6의 W5-02 PWA `dc13fd92…`를 빌드한 APK다. 설치 파일 SHA-256은 `f41d81a4a8060b2f3af209298ee75d5fbb7fac6d7d6a194ea2d62dd321ae97b8`다. 기존 11개 구간을 프로브 없이 한 차례 왕복했을 때 각 구간의 버퍼 p95는 8.33–16.66ms였다. 중단 방향 전환에서 58.32ms, 이미지 접근에서 41.66ms까지 측정됐다. 중단 방향 전환의 58.32ms 간격은 위치를 고정한 구간을 뺀 측정에서 사라졌고, 움직이는 동안의 최장 간격은 16.66ms였다. CSS 대조의 표시 p95는 8.33ms였다.

사용자가 손을 뗀 뒤의 끊김을 확인하기 위해 Android 입력 주입기가 `ACTION_UP`을 보내기 직전의 단조 시각을 남겼다. `--inertia`는 이 시점을 경계로 드래그와 관성 이후 버퍼를 각각 집계한다. 이미지 바로 앞에서 손을 떼는 플링을 추가했다. 움직임이 끝난 뒤 제출되는 버퍼도 관성 창에 들어갈 수 있어 시간 위치와 섹션 작업을 대조했다. [입력 및 표시 측정](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

| 기준 APK 계측 | 손을 뗀 뒤 확인한 작업 | 겹치는 표시 간격 |
| --- | --- | --- |
| 상단 첫 플링 | 약 537ms에 **Destinations and drawer** 생성 15.4ms, 레이아웃 6.2ms | 552.17–593.83ms 사이 41.66ms |
| 중하단 첫 플링 | 약 158ms에 **Switches** 생성 7.6ms, 레이아웃 2.7ms | 섹션 생성 시점에 33.3ms 이상 간격 없음 |
| 이미지 첫 진입 플링 | 초기 WebP 동기 디코딩 17.7ms, 임시 표면 3.4ms, 스냅샷 1.7ms. 첫 텍스처 업로드 2.1ms | 70.16–103.48ms 사이 33.32ms |

상단 플링의 41.66ms 간격은 첫 생성 프레임에 겹쳤다. 손을 뗀 직후 측정에서 상단 native submit 최장값은 1.4ms였다. 관성 틱은 현재 프레임에서 다음 프레임을 예약한다. 그 결과 `ViewRuntime`의 `dirty`만 검사하던 조건은 이미 현재 프레임이 제출됐어도 브라우저 유휴 준비를 차단한다. 후보는 제출한 프레임의 입력 시퀀스와 프레임워크의 현재 레이아웃·페인트 검증을 통과한 경우에 한해 유휴 작업을 허용한다. [프레임 호스트](Nelyx/src/hosting/runtime.ts) · [버퍼 검증](Nelyx/src/framework/widgets/root.ts)

기준 APK에서 Galaxy의 단일·범위 슬라이더 취소와 재드래그, EditContext의 키보드 `804` 입력과 한글 조합, 선택 범위 0과 17, 줄 바꿈 높이 48→24px를 확인했다. 하단 이미지의 색 추출, WebGL 컨텍스트 복구, 빠른 재진입에서 주황색 픽셀은 각각 229,025개였다. 입력은 ADB와 WebView DevTools로 수행했다.

### WebCodecs 이미지 후보

큰 불투명 단일 프레임 VP8 WebP는 원본 크기에서 WebCodecs로 디코딩한 뒤 sRGB RGBA를 복구 가능한 CanvasKit 래스터 이미지로 등록한다. 헤더에서 애니메이션, 크기와 바이트 예산을 확인한다. 투명 이미지, 애니메이션, 크기 변경, 지원되지 않는 디코더는 기존 경로를 사용한다. 호스트 Chromium에서 Demo 원본의 RGBA 5,529,600바이트가 일치했다. 두 프레임을 발급한 뒤 코덱을 폐기해도 마지막 프레임까지 읽을 수 있었고, RGBA 복사 실패 시 대체 디코딩과 정리도 통과했다. Galaxy 계측에서는 브라우저 디코딩 대기 15.0ms, RGBA 복사 호출 4.7ms, CanvasKit 이미지 등록 3.0ms였다. `MakeSurface`와 스냅샷은 호출되지 않았다. [WebP 컨테이너](https://developers.google.com/speed/webp/docs/riff_container) · [WebCodecs 이미지 디코더](https://www.w3.org/TR/webcodecs/#imagedecoder) · [구현](Nelyx/skia/packages/web/src/webp-decode.ts)

기준과 이미지 후보를 번갈아 3쌍 실행했다. 앱 프로브는 끄고, 동일한 화면과 WebGL2 래스터에서 SurfaceFlinger 버퍼로 비교했다. 아래 수치는 이미지 카드 쪽 플링이다. 여섯 번의 CSS 대조 p95는 8.33ms였다.

| 쌍 | 전체 플링 p95 | 손을 뗀 뒤 p95 | 손을 뗀 뒤 최장 |
| --- | ---: | ---: | ---: |
| 1 | 41.65 → 16.66ms | 16.66 → 16.66ms | 108.32 → 49.98ms |
| 2 | 33.32 → 16.66ms | 33.32 → 8.33ms | 108.30 → 108.26ms |
| 3 | 33.32 → 16.66ms | 8.33 → 8.33ms | 58.32 → 83.31ms |

두 번째 후보 실행은 플링 직전에 이미 이미지 제목이 표시됐다. 세 번째 후보는 손을 뗀 직후 간격이 늘었다. 첫 진입의 반복 끊김 개선은 판정 보류했다. 메시지 옵션 버튼의 위치를 맞추고 이미지가 숨은 상태에서 짧게 밀어 관성으로 진입하는 경로를 추가했다. 구형 WebView가 RGBA와 색 공간 옵션을 무시하는 경우를 걸러 내는 변경은 Skia·SDK 빌드까지 통과했다. 이 옵션 검사를 넣은 APK는 아직 빌드하지 않았다.

### 관성 중 유휴 준비 후보

Core의 섹션 사전 준비 검사에서 다음 애니메이션 틱이 예약된 상태로 브라우저 유휴 준비를 실행한 후, 보이는 구간에서 사전 생성한 같은 위젯을 한 번 인계했다. 새로 요청한 프레임이나 기한이 부족한 유휴 콜백에서는 기존 대기 동작을 검증했다. [Core 회귀 검사](Nelyx/eng/check-section-preparation.mjs)

Galaxy에 유휴 준비 후보를 설치한 한 차례의 계측에서는 중하단 **Switches**를 손을 뗀 약 131ms 뒤 인계 0.8ms, 레이아웃 2.6ms로 처리했다. 기준 계측의 같은 섹션은 생성 7.6ms, 레이아웃 2.7ms였다. 후보의 상단 플링은 **Dialogs** 부근에서 멈춰 기준의 **Destinations and drawer** 첫 진입까지 도달하지 않았다. 상단의 41.66ms 간격과 중하단의 99.98ms 간격은 계측된 마지막 위치 변경 프레임 제출 뒤 시작됐다. 이미지 진입에서는 최초 생성 17.5ms와 레이아웃 6.7ms가 실제 이동 중 41.66ms 간격과 겹쳤다.

후보가 이미지 제목까지 도달하고 디코딩한 뒤, 진입 제스처의 종점에서 이미지 접근성 레이블을 기다리는 검사가 12초 뒤 종료됐다. 해당 실행의 재방문과 세 쌍의 무계측 비교는 시작하지 못했다. 후보를 설치하기 전의 이미지 후보 APK를 Galaxy에 복원했고 설치 파일 해시를 확인했다. 검사용 ADB 포워딩, 입력 도구와 임시 APK는 정리했다.

## 8. 일시정지 시점의 상태

| 대상 | 확인한 빌드와 상태 |
| --- | --- |
| Galaxy에 설치된 이미지 후보 | PWA `2045f6d48c1322d78102a9422ef2ac34f5872e923268c23ee98d990eb07eca50`, APK SHA-256 `bc43c981fb0cdcd8f69e5da5877b2fd911674f93278a4766d424a9bb360cd555` |
| 로컬 arm64 유휴 준비 후보 | PWA `f646476d19da1756e4c1b53a72aabfaef9dacc13fa8002280317e9169ab1bcd9`, APK SHA-256 `c4c5202b451f5ebf9a97a9316dc885b5ad64a9562a7c65303a50f7b6d52be132` |
| 작업 디렉터리 | 유휴 준비, 관성 구간 측정, 구형 WebView의 RGBA 옵션 검사, 입력 장식 변경을 보존. 러너에는 위 로컬 arm64 후보를 만들 때 공급한 패키지가 설치되어 있음 |
| 남은 인수 | 같은 출발점과 끝 카드를 사용한 Galaxy 무계측 비교, 이미지 진입 레이블 확인, 최신 두 후보의 기능 재검증과 실제 손가락 관성·방향 전환 확인. Pixel 5의 활성 이동 p95 목표와 W5-03의 안전한 가지치기 범위도 확인이 남아 있음 |

사용자 요청으로 `PAUSED / PARTIAL` 상태로 정리했다.

## 9. Pixel 5에서 이미지 경로 구조 개선

### 시작 자산

Web 호스트는 앱이 자산을 명시하지 않으면 전체 매니페스트를 시작 자산으로 해석한다. Demo에서 이 경로는 `component-image.webp`를 초기 화면 전에 CanvasKit으로 읽었다. 하단 카드의 `AssetImage`는 같은 바이트를 ImageService에서 다시 가져와 코덱을 만들었다. Demo Web 러너의 시작 자산에는 글꼴을 명시했다. 하단 이미지의 로드와 해시 검증은 이미지가 요청될 때 ImageService에서 수행한다. [호스트 기본 자산](Nelyx/sdk/src/backends/browser/services.ts) · [Demo Web 러너](sample/nelyx-demo-app/web/runner/App.tsx)

### 구형 WebView 디코딩 후보

Pixel 5의 WebView 109에서는 WebCodecs의 RGBA·sRGB 복사 경로 조건이 충족되지 않아 CanvasKit의 동기 디코딩과 임시 표면 복사가 실행됐다. Worker에서 `createImageBitmap`과 sRGB `OffscreenCanvas`로 960×1440 WebP를 처리한 뒤 RGBA 버퍼를 넘기는 후보를 만들었다. 렌더링 스레드는 그 버퍼로 복구 가능한 CanvasKit 래스터 이미지를 등록했다. 번들에 포함한 ICC 프로필을 적용한 RGBA 5,529,600바이트는 같은 WebView의 기존 CanvasKit 스냅샷과 전부 일치했다. [WebP 경로 선택](Nelyx/skia/packages/web/src/webp-decode.ts)

별도 이미지 기능 실행에서 기존 코덱의 동기 디코딩 30.4ms, 임시 표면 6.0ms, 스냅샷 3.3ms를 관측했다. 워커 경로의 메인 스레드 생성 호출은 0.2ms, 결과 대기는 143.7ms, CanvasKit 등록은 14.6ms였다. 960×1440 임시 표면과 스냅샷 호출은 각각 1회에서 0회로 줄었다. 기준과 후보 모두 색상 팔레트 두 개를 추출했다. 컨텍스트 복구와 재진입에서 주황색 픽셀은 각 222,809개로 일치했다.

### 표시 측정과 이미지 확인

관성 스크롤 검사에서는 카드 제목의 가시성으로 이미지 구간의 도착을 확인한다. 앞선 플링에서 이미지 카드까지 이동한 경우 메시지 옵션 버튼으로 되돌아가고, 뒤이은 이미지 플링을 `image-reentry-fling`으로 기록한다. 이미지 접근성 노드, 색상 추출과 실제 픽셀은 `--controls=image`로 검사한다. APK 비교에는 동일한 Android 터치 주입기를 사용한다. `--cpu --controls=image`는 디코드와 첫 텍스처 업로드도 출력한다. [Android 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

시작 자산을 바꾸기 전에 786×1602 WebGL2에서 두 APK를 번갈아 실행했다. 기준은 ICC가 있는 Demo WebP를 CanvasKit 코덱으로 읽었고 후보는 그 자산에 워커를 적용했다. 계측 프로브를 끄고 Perfetto에서 SurfaceFlinger 버퍼를 집계했다.

| APK | PWA 빌드 ID | SHA-256 |
| --- | --- | --- |
| CanvasKit 코덱 | `7fb67e47846700640d2bbc9fc70bb5a5dc52eb6b1b046a33ad5989f5436011a2` | `48b88881efadcc961f572875ab8ddaf4057792c4bfe492a00987fb662f2be562` |
| WebP 워커 | `eb2a99ace9eafe78f16069a1d524402ff7d4ade4330e87b8bc7e6144570a22b7` | `92bae95ca07faa9b9ceeb5214f3c3e3ccb2df2fcc32bb0f2b09d6841ed560881` |

| 쌍 | 이미지 구간 | 첫 버퍼 지연 (ms) | p95 (ms) | 33.3ms 이상 / 유효 간격 | CSS p95 (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | 첫 진입 | 99.59 → 103.46 | 70.28 → 92.68 | 10/16 → 9/15 | 41.32 → 42.38 |
| 2 | 첫 진입 | 115.63 → 103.11 | 88.16 → 56.46 | 10/15 → 9/17 | 41.43 → 41.36 |
| 3 재실행 | 재진입 | 113.36 → 108.60 | 70.73 → 67.56 | 8/12 → 9/15 | 43.92 → 42.74 |

첫 두 쌍은 이미지 진입 후 주변에 보이는 카드가 달랐다. 세 번째 재실행은 양쪽 모두 앞선 플링에서 이미지 카드를 이미 열었고, 재진입 구간의 시작·종료 카드가 일치했다. CSS 대조는 여섯 실행 모두 p95가 40ms를 넘었다. 시작 자산 변경을 함께 적용한 PWA `c580ab8815213e47708d1c95c26d3280e0adc73a172c888a7bc08d6914fe260d`의 별도 기능 실행에서는 워커 결과 대기 227.0ms와 등록 2.2ms를 관측했다. 해당 APK의 SHA-256은 `045b522def21093f9c5ccc342f23da7ecd53c6b163b6777bf24378398f084765`다. 결과 대기가 길고 표시 개선이 일관되지 않아 워커 후보를 제외했다. 시작 자산 변경을 채택했다.

### 채택 APK 재검증

Pixel 5 `emulator-5554`, API 33 x86_64, WebView 109.0.5414.123, 786×1602 WebGL2에서 확인했다. PWA 빌드 ID는 `bb8db58fa55731f35725d056f03445b8cb4bb8d4f4698eb3e57c8254a04a2bbb`, APK SHA-256은 `f1269188b4054cd31ef26736fd9e7b3cf5b0fe214356275b79edc98dfd0098dc`다. CanvasKit은 §5의 `m153-nelyx-paragraph.8`을 사용했다.

시작 자산용 `MakeImageFromEncoded`에서 관측한 960×1440 호출은 1회에서 0회로 줄었다. 갤러리에서 이미지가 필요해진 뒤 `MakeAnimatedImageFromEncoded`를 한 번 호출했다. 새로고침 없이 수집한 이 실행의 디코더 생성은 48.1ms, 임시 표면 3.3ms, 스냅샷 2.4ms, 최초 업로드 3.8ms였다. 색상 팔레트 두 개를 추출했고 WebGL 복구 전후와 재진입에서 픽셀 수는 모두 222,809개였다.

같은 APK에서 앱 프로브를 끄고 11개 구간을 모두 수집했다. 마지막 이미지까지 이동한 뒤 첫 카드로 복귀했고 하단 재방문까지 수행했다. 아래 표의 마지막 열은 제스처 끝에 정지 구간이 있어 이동 종료 시점으로 따로 자를 수 있었던 구간의 p95다.

| 구간 | 첫 버퍼 지연 (ms) | p95 (ms) | p99 (ms) | 최장 (ms) | 33.3ms 이상 / 유효 간격 | 이동 종료 전 p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 상단 첫 플링 | 204.68 | 164.77 | 164.77 | 164.77 | 5/7 | — |
| 중단 방향 전환 | 94.84 | 63.79 | 63.79 | 63.79 | 10/12 | 63.79 |
| 중하단 첫 플링 | 109.61 | 107.29 | 107.29 | 107.29 | 6/12 | — |
| 하단 방향 전환 | 117.19 | 52.20 | 52.20 | 52.20 | 6/13 | 52.20 |
| 이미지 접근 1 | 84.64 | 49.36 | 54.19 | 54.19 | 16/34 | 49.36 |
| 이미지 접근 2 | 100.51 | 55.92 | 57.03 | 57.03 | 16/33 | 50.18 |
| 이미지 접근 3 | 137.01 | 79.77 | 86.11 | 86.11 | 18/22 | 79.77 |
| 이미지 접근 4 | 138.00 | 67.05 | 77.42 | 77.42 | 17/23 | 67.05 |
| 중하단 재방문 플링 | 100.90 | 67.85 | 67.85 | 67.85 | 7/15 | — |
| 하단 재방문 방향 전환 | 72.03 | 65.05 | 65.05 | 65.05 | 8/13 | 65.05 |
| CSS 대조 | — | 43.14 | 45.82 | 45.82 | 20/51 | — |

Pixel 5의 33.33ms 목표는 미달이다. CSS 대조의 p95는 43.14ms였고 상단 첫 플링의 유효 간격은 7개였다. 채택 APK의 단일 왕복은 표시 수치를 기록한 실행이며 시작 자산 변경의 스크롤 속도 개선 폭은 판정하지 않았다. Galaxy 실기기와 손가락 입력 인수는 남아 있다.

채택 APK에서 단일·범위 슬라이더의 느린 드래그, 방향 전환, 취소 후 재드래그와 세로 스크롤을 확인했다. 소프트 키보드에서 `804`를 입력했고 한글 조합, 선택 위치 0·17과 줄바꿈에 따른 높이 48→24px가 통과했다. Chromium DPR 1·2의 부분 노출 버튼 클리핑, Core 섹션 인계, 입력 장식 레이아웃, RTL 범위 슬라이더 접근성 및 Demo 타입 검사도 통과했다. 설치된 APK 해시를 재확인했으며 에뮬레이터를 첫 카드 화면으로 돌려놓았다.

## 10. 구형 WebView의 첫 이미지 디코딩

**2026-11-22** · §9에서 채택한 APK는 시작 자산의 중복 디코딩을 제거했다. WebView 109에서 갤러리 이미지를 처음 요청하면 CanvasKit의 동기 디코딩 48.1ms와 임시 표면·스냅샷 비용이 남았다. 기존 워커를 실행한 별도 계측에서는 결과 대기가 227.0ms까지 길어졌다. 상단 첫 플링의 WebGL 링크 병목은 §5의 별도 구간이다.

브라우저의 `createImageBitmap(Blob)`과 sRGB 2D 읽기 경로를 시험했다. 786×1602 WebGL2에서 비트맵 결과는 37.2ms에 도착했고, 첫 `drawImage`가 165.2ms 동안 메인 스레드를 점유했다. 결과 호출 다음에 동기 병목이 남아 이 후보를 제외했다. 시험 APK는 PWA `01dcfb791a01120dd4593164f2c311040a04e63d3763f2d5cc3e8b6297186e8f`, SHA-256 `82a62e1a147187c6a94228d2e5ffdefe83d85f22e110988b2884339731aa46bc`다. [HTML Standard의 Blob 디코딩](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#dom-createimagebitmap)

Chromium 109의 WebP 소스는 ICC 프로필이 있는 프레임을 RGB로 디코딩한다. Pixel 5에서 `ImageDecoder`가 반환한 프레임은 RGBX였고 색 공간 속성은 비어 있었다. 구형 WebView 경로는 검증한 456바이트 sRGB ICC 프로필의 SHA-256이 일치할 때만 그 프레임의 packed RGB 픽셀을 직접 복사한다. BGR 채널 순서와 불투명 알파를 CanvasKit의 RGBA 형식에 맞춘다. 최신 WebCodecs는 명시적 RGBA·sRGB 변환을 사용한다. 크기 변경, 애니메이션, 투명 이미지, 지원되지 않는 픽셀 형식과 색 공간은 CanvasKit 코덱에서 처리한다. [WebP 디코더](Nelyx/skia/packages/web/src/webp-decode.ts) · [Chromium 109 WebP 디코더](https://github.com/chromium/chromium/blob/109.0.5414.123/third_party/blink/renderer/platform/image-decoders/webp/webp_image_decoder.cc)

Pixel 5의 별도 검증에서 네이티브 픽셀 복사 결과는 같은 CanvasKit 버전에서 읽은 sRGB RGBA 5,529,600바이트와 전부 일치했다. 이미 디코딩된 `VideoFrame`을 2D 캔버스에 직접 그리는 경로도 비교했다. 3회의 `drawImage` 호출은 110.6·6.3·4.9ms로 첫 호출이 길었다. 최종 후보는 `VideoFrame.copyTo`로 픽셀을 그대로 가져온다.

이전에는 앞선 플링의 이동 거리에 따라 이미지 진입 측정이 재방문이 되기도 했다. `--image-entry-only`는 새 앱 프로세스에서 느린 스와이프로 입력창 구역에 접근하고, 메시지 옵션 버튼에 맞춘 뒤 일정한 드래그를 하고 정지한다. 이미지 카드의 이전 방문 기록을 확인하고, 측정 이후 이미지 접근성 노드가 나타났는지 검사한다. `--timeline`의 이동 종료 전 버퍼 통계를 CSS 대조와 함께 사용한다. [Android 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

### APK와 이미지 경로 확인

Pixel 5 `emulator-5554`, API 33 x86_64, WebView 109.0.5414.123의 786×1602 WebGL2에서 §9의 채택 APK와 비교했다. 새 PWA는 `4669dc4e027621d941e6bd958ff1b6f6b559f25d31251e458222d8a9ade49d00`, 디버그 APK SHA-256은 `6f6882941e1c146c993498cdf56f564ea54c178b514fa371b855735362870292`다. 런타임은 §5의 `m153-nelyx-paragraph.8`이다. 표준 패키징에서 Tauri가 실행한 `llvm-readelf` 하위 프로세스가 종료 코드 `0xC000013A`를 반환했다. 빌드한 Rust 라이브러리를 PowerShell에서 같은 `llvm-readelf -d`로 확인하고 Gradle에서 기존 라이브러리를 디버그 APK에 패키징해 ADB로 설치했다. Gradle의 출력 파일은 이후 빌드에서 갱신된다. [Gradle 디버그 APK 경로](sample/nelyx-demo-app/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk)

| `--cpu --controls=image` 단계 | §9 APK | §10 APK |
| --- | ---: | ---: |
| CanvasKit 동기 디코더 생성 | 87.9ms | 0회 |
| 원본 크기 임시 표면 · 스냅샷 | 11.5 · 5.7ms | 0회 |
| `ImageDecoder` 디코드 요청 · 비동기 응답 | — | 7.2 · 10.8ms |
| `VideoFrame.copyTo` 호출 · CanvasKit `MakeImage` | — | 4.5 · 3.3ms |
| 최초 텍스처 업로드 | 8.1ms | 9.5ms |

새 APK는 로컬 이미지의 색상 팔레트 두 개를 추출했다. 첫 표시, WebGL 복구 후 표시 및 재진입의 주황색 픽셀 수는 두 APK 모두 222,809개였다. 동적 이미지의 등록 크기는 두 APK에서 5,529,600바이트였다.

### 첫 이미지 진입의 버퍼 표시

NVIDIA 호스트 GPU에 연결된 기본 에뮬레이터에서 앱 내부 프로브를 끄고 첫 이미지 드래그를 교차 비교했다. 첫 버퍼 지연과 표시 간격은 Perfetto FrameTimeline의 실제 버퍼 표시 시각으로 계산했다.

| 쌍 | 첫 버퍼 지연 (ms) | p95 (ms) | 33.3ms 이상 / 유효 간격 | 이동 중 p95 (ms) | CSS p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 154.10 → 126.31 | 110.33 → 112.46 | 12/12 → 11/11 | 110.33 → 104.66 | 97.00 → 93.61 |
| 2 | 126.04 → 129.27 | 107.90 → 115.72 | 14/14 → 14/14 | 99.91 → 115.72 | 95.02 → 94.08 |
| 3 | 149.46 → 120.43 | 107.34 → 103.87 | 12/12 → 12/12 | 99.30 → 103.87 | 99.09 → 95.44 |

세 쌍 모두 새 앱 프로세스의 첫 이미지 방문이었다. 두 번째와 세 번째 쌍은 시작·종료 카드가 일치했다. 첫 번째 쌍의 기준 화면에는 종료 시 **Write something**이 추가로 보였다. 이동 중 유효 간격은 실행마다 4–5개였고 CSS p95는 93.61–99.09ms였다. 이 비교에서는 표시 개선을 확인하지 못했다.

11개 구간의 전체 왕복은 두 APK에서 완료했다. 중간 방향 전환의 p95는 104.26 → 117.11ms, 같은 카드로 왕복한 중하단 재방문 플링은 103.63 → 96.74ms, 그 다음 방향 전환은 116.86 → 98.89ms였다. 후보의 상단 첫 플링에는 쓸 수 있는 버퍼 표시 표본이 없었다. 중하단 첫 플링부터 이미지 접근 세 번째까지는 도착 카드 또는 출발 카드가 서로 달랐다. CSS 대조 p95는 96.14 → 92.91ms였다.

새 APK에서 단일·범위 슬라이더의 느린 드래그, 방향 전환, 취소 후 재드래그와 세로 스크롤을 확인했다. Android 키보드에서 `804`를 입력했고 한글 조합과 선택 위치 0·17을 확인했다. 검사를 마친 뒤 `emulator-5554`의 설치 해시와 `x86_64` ABI를 다시 확인했고, 앱을 첫 카드 화면에 두었다.

### 이전 SwiftShader 실행 기록

하드웨어 GPU 인수에서는 아래 SwiftShader 수치를 제외한다.

별도 임시 Pixel 5 프로필에서 SwiftShader로 GPU를 에뮬레이션했다. Android API 33 x86_64, WebView 109.0.5414.123과 CanvasKit 786×1602 WebGL2를 확인했다. 변경 APK의 CSS 단독 대조 p95는 36.04ms였고 첫 이미지 드래그 실험에 포함한 CSS 대조는 37.58ms였다.

변경 APK의 첫 이미지 진입은 첫 버퍼 지연 100.16ms를 기록했다. ADB 드래그 입력의 이동 구간에서 표시 간격 p95는 32.04ms였고 간격 23개 모두 33.3ms 미만이었다. 드래그 끝의 정지와 카드 표시까지 포함하면 p95 84.08ms였고 간격 36개 중 5개가 33.3ms 이상이었다. 이 수치는 SwiftShader에서 변경 APK를 단독 실행한 결과다.

같은 프로필의 한 차례 전체 왕복에서 CSS p95는 31.16ms였다. 상단 첫 플링의 첫 버퍼는 794.06ms에 표시됐고 간격을 계산할 표본이 부족했다. 나머지 갤러리 구간의 p95는 47.33–171.37ms였다. 전체 왕복 뒤 임시 에뮬레이터를 종료하고 프로필을 삭제했다.

검증한 sRGB WebP의 픽셀 직접 등록을 유지한다. 원본 크기 임시 표면과 큰 동기 디코더 호출을 없앴고 이미지 복구와 입력 검사도 통과했다. Pixel 5 전체 경로의 33.33ms 목표와 상단 첫 플링은 `PARTIAL`이다. Galaxy 실기기와 실제 손가락 입력 인수는 남아 있다.

## 11. Android 렌더러 선택

CanvasKit은 최초 표면을 열 때와 WebGL 컨텍스트를 복구할 때 브라우저의 기본 WebGL2 컨텍스트 선택을 사용한다. WebView가 소프트웨어 WebGL 호환 경로를 선택해도 앱이 그 컨텍스트를 사용할 수 있다. [CanvasKit 화면 표면](Nelyx/skia/packages/web/src/library.ts) · [WebGL 컨텍스트 속성](https://registry.khronos.org/webgl/specs/latest/1.0/#5.2.1)

Android 스크롤 성능 검사는 실제 갤러리 캔버스와 SurfaceFlinger의 렌더러를 확인하며, 소프트웨어 렌더러에서의 성능 계측은 중단한다. `--controls` 기능 검사는 현재 렌더러를 기록하고 진행한다. 이미지 복구 검사는 픽셀이 다시 표시된 뒤 렌더러를 다시 읽는다. [Android 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

모의 WebGL 컨텍스트에서 SwiftShader를 보고하거나 렌더러 정보가 없어도 CanvasKit 화면 표면을 생성하고 복구했다. 성능 검사의 렌더러 확인 함수는 SwiftShader를 거부했고 RTX 4060을 허용했다.

Pixel 5 `emulator-5554`의 WebView 109에서 `failIfMajorPerformanceCaveat` 값이 `false`였고 WebView와 SurfaceFlinger는 RTX 4060을 사용했다. 이미지 초기 표시·WebGL 복구·재진입의 주황색 픽셀 수는 각각 222,809개였으며, 복구 뒤에도 같은 GPU를 확인했다. Cargo와 Gradle로 만든 x86_64 디버그 APK의 SHA-256은 `ea1c2261a93e437a2df36207cd21f79c42aab53ecfdda4de396412ae449e4fe6`이고 설치 해시와 일치했다. PWA 빌드 ID는 `4669dc4e027621d941e6bd958ff1b6f6b559f25d31251e458222d8a9ade49d00`이다. [현재 Gradle 디버그 APK](sample/nelyx-demo-app/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk)

`run:android`의 패키지 매니페스트는 이전 빌드를 가리킨다. 이번 검증에서는 Gradle 디버그 APK를 ADB로 설치했다.

## 12. 기존 Pixel 5 재시작과 관성 스크롤 재검증

### 에뮬레이터 실행 상태

기존 `Pixel_5`에서 갤러리가 정지한 상태로 CSS 사각형만 움직였을 때 버퍼 표시 간격 p95는 99.99ms였고, 유효 간격 22개 모두 33.3ms를 넘었다. 별도 Pixel 5 프로필을 새로 부팅했을 때는 동일한 기준 APK에서 p95가 20.01ms였다. 두 프로필 모두 API 33, WebView 109.0.5414.123과 RTX 4060의 WebGL2를 사용했다.

기존 `Pixel_5`를 종료하고 `-no-snapshot-load`로 다시 열었다. 기준 APK의 첫 카드가 표시됐고, 동일한 CSS 대조의 p95는 **18.91ms**, p99와 최장은 **19.86ms**였다. 유효 간격 89개 중 33.3ms 이상은 0개였다. 두 번의 CSS 대조에서 CanvasKit 래스터는 786×1602로 일치했다. 앱의 CanvasKit 경로와 Android의 OpenGL HWUI 경로를 사용했다. [Perfetto FrameTimeline](https://perfetto.dev/docs/data-sources/frametimeline)

같은 AVD의 앱 데이터와 하드웨어 설정으로 다시 시작할 때 쓴 명령이다. 종료가 완료된 뒤 다음 명령을 실행한다.

```powershell
adb -s emulator-5554 emu kill
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd Pixel_5 -port 5554 -no-snapshot-load
```

### 다음 프레임 전의 카드 준비 후보

런타임은 GPU 제출이 끝난 뒤 준비를 재개하기 위해 다음 화면 콜백을 예약한다. 관성 중에는 그 콜백의 필수 레이아웃에서 준비 중인 카드가 이미 필요할 수 있다. 브라우저에서 GPU 제출이 끝나고 대기 중인 프레임과 새 입력이 없을 때 `requestIdleCallback`을 바로 예약하는 후보를 만들었다. 콜백에서는 프레임 유효성, 입력 순서와 남은 시간 예산을 다시 확인했다. [ViewRuntime](Nelyx/src/hosting/runtime.ts)

후보의 Core 검사에서 GPU가 바쁜 동안 준비를 보류하고, 완료 알림이 오면 다음 화면 콜백 전에 유휴 시간을 얻었다. 동일 위젯을 가시 레이아웃에서 한 번 인계했고, 새 프레임 요청, 소진된 예산, 뷰 숨김, 역방향 상태 유지도 확인했다.

재시작한 `emulator-5554`에서 기준과 후보를 번갈아 설치해 세 쌍의 표준 왕복을 끝냈다. APK 해시와 실행 중 PWA 빌드 ID를 확인했다. 여섯 실행 모두 786×1602, GPU WebGL2를 사용했다. 표시 측정 중 WebGL·CPU 프로브는 끄고, 각 쌍의 접근성 카드 시작·종료 목록이 일치하는지 확인했다.

| APK | PWA 빌드 ID | APK SHA-256 |
| --- | --- | --- |
| 기준 | `4669dc4e027621d941e6bd958ff1b6f6b559f25d31251e458222d8a9ade49d00` | `ea1c2261a93e437a2df36207cd21f79c42aab53ecfdda4de396412ae449e4fe6` |
| 유휴 예약 후보 | `8689afead17bbf8685c2c2bfb9169f392e1f6d52ff2a8bb1287b1bfaf1ad87e2` | `48a79cb565765a6256ad7e800f69a5f940adabe677b1c94aaacae77733efa1b3` |

표의 첫 표시, p95, p99는 각 APK의 세 실행 중앙값이다. 최장과 긴 간격의 횟수는 세 실행 전체에서 집계했다. 카드 목록이 달랐던 쌍도 표에 포함했으며, 채택 판정에는 시작·종료 목록이 일치한 쌍을 사용했다.

| 구간 | 카드 일치 | 첫 표시 (ms) | p95 (ms) | p99 (ms) | 최장 (ms) | 33.3ms 이상 / 간격 수 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 상단 첫 플링 | 3/3 | 149.76 → 158.76 | 102.63 → 99.67 | 102.63 → 99.67 | 116.10 → 114.47 | 9/23 → 8/24 |
| 중단 방향 전환 | 0/3 | 67.10 → 50.05 | 18.85 → 18.36 | 19.78 → 22.31 | 21.12 → 23.17 | 0/88 → 0/89 |
| 중하단 첫 플링 | 2/3 | 66.95 → 50.13 | 64.89 → 33.40 | 101.25 → 82.86 | 116.78 → 83.14 | 8/74 → 6/87 |
| 하단 방향 전환 | 2/3 | 85.05 → 66.77 | 20.43 → 19.10 | 29.90 → 20.11 | 32.08 → 20.95 | 0/85 → 0/87 |
| 이미지 접근 1 | 0/3 | 46.94 → 75.38 | 18.56 → 20.05 | 19.46 → 27.07 | 31.31 → 27.95 | 0/215 → 0/208 |
| 이미지 접근 2 | 0/3 | 76.27 → 80.73 | 32.85 → 28.00 | 46.64 → 33.76 | 52.82 → 35.61 | 7/192 → 5/191 |
| 이미지 접근 3 | 3/3 | 79.39 → 102.04 | 34.18 → 33.10 | 39.60 → 34.81 | 84.87 → 37.02 | 11/179 → 9/180 |
| 이미지 접근 4 | 3/3 | 85.45 → 97.45 | 32.00 → 34.06 | 34.79 → 35.28 | 35.47 → 36.61 | 8/191 → 10/182 |
| 중하단 재방문 플링 | 1/3 | 66.61 → 59.94 | 21.56 → 19.20 | 31.61 → 19.47 | 34.17 → 30.50 | 2/101 → 0/105 |
| 하단 재방문 방향 전환 | 1/3 | 53.55 → 56.70 | 18.53 → 18.32 | 19.81 → 18.82 | 23.19 → 19.82 | 0/90 → 0/88 |
| CSS 대조 | — | — | 18.55 → 18.56 | 19.04 → 19.44 | 20.18 → 20.20 | 0/267 → 0/267 |

중하단 첫 플링에서 카드가 일치한 두 쌍의 손을 뗀 뒤 p95는 116.78 → 19.98ms와 82.58 → 82.86ms였다. 마지막 이미지 접근의 드래그 중 p95는 34.48 → 32.79ms, 22.87 → 34.45ms, 32.00 → 34.35ms였다. 이미지 구간에서 두 차례 회귀해 유휴 예약 후보를 되돌렸다. 기존에 적용된 관성 중 유휴 준비는 다시 Core 검사로 확인했다.

후보의 별도 계측에서 상단의 첫 프로그램 네 개를 링크한 `flush()`는 58.4ms였고 링크 상태 조회가 31.0ms였다. 중하단 첫 플링에서는 손을 뗀 약 115ms 뒤 **Write something**이 들어와 생성 43.6ms와 레이아웃 10.9ms를 썼다. 해당 실행의 마지막 이미지 진입 제스처는 카드에 도달하기 전에 끝났다. 이 계측은 각 구간의 남은 작업을 보여 준다.

### 첫 링크 후보

일반 경로로 기록된 둥근 테두리 중 안쪽 윤곽을 안전하게 포함하는 경우만 CanvasKit의 `drawDRRect`로 재생했다. 시작 카드와 도착 카드가 일치한 상단 플링의 두 계측에서 셰이더 컴파일 8회와 프로그램 링크 4회가 각각 그대로 관측됐다. 이 후보는 첫 링크를 줄이지 못해 되돌렸다. 화면 밖 Picture 조사는 §5의 보수적인 조건에 해당하는 재생이 0건이어서 종료했다. [Ganesh의 둥근 테두리 그리기](https://github.com/google/skia/blob/61e7ca4e99062cdd0ab69445d5963fb3365778f6/src/gpu/ganesh/Device.cpp#L3240)

### 재시작한 Pixel 5의 최종 실행

기존 W5 소스와 패키지를 다시 빌드했다. Android 번들 명령의 Cargo 하위 프로세스가 Windows에서 `-1073741510`으로 끝나, Cargo와 Gradle을 직접 실행해 x86_64 디버그 APK를 만들었다. 로컬·설치 APK SHA-256은 `cfd16e74ca27f0273e9df742e6248d4248713b603cf82031084edac3cae12869`로 일치했다. PWA 빌드 ID는 기준의 `4669dc4e027621d941e6bd958ff1b6f6b559f25d31251e458222d8a9ade49d00`으로 돌아왔다. [디버그 APK](sample/nelyx-demo-app/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk)

이미지 진입 플링은 짧은 입력에서 메시지 옵션에 멈추는 경우가 있어 205ms로 늘렸다. 변경한 `--timeline --inertia`는 처음부터 **Local and network images**까지 이동하고 재방문과 방향 전환을 끝냈다. 이미지 카드 진입은 화면에 보이는 제목으로 확인했다. [Android 관성 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

| 구간 | 전체 p95 (ms) | 손을 뗀 뒤 p95 (ms) | 손을 뗀 뒤 33.3ms 이상 / 간격 수 |
| --- | ---: | ---: | ---: |
| 상단 첫 플링 | 100.74 | 100.74 | 2/5 |
| 중하단 첫 플링 | 82.75 | 82.75 | 3/24 |
| 첫 이미지 플링 | 34.14 | 34.14 | 1/6 |
| 중하단 재방문 플링 | 19.30 | 19.04 | 1/26 |
| 하단 재방문 방향 전환 | 18.55 | — | — |
| CSS 대조 | 19.08 | — | — |

단일·범위 슬라이더의 느린 이동, 방향 전환, 취소 후 재드래그와 트랙에서 시작한 세로 스크롤이 통과했다. Android 키보드의 `804` 입력, 한글 조합과 선택 위치도 확인했다. 이미지의 초기 표시, WebGL 복구 후, 재진입에서 주황색 픽셀은 각각 222,809개였고 색상 추출도 통과했다. Core 섹션 인계 검사, Demo 타입 검사, `git diff --check`를 확인했다.

임시 AVD와 측정 로그, 기준 APK 사본 및 추적 도구를 정리했다. 기존 에뮬레이터는 Demo 첫 카드에 열어 두었고, 이 프로세스가 연 시작 로그 두 개는 종료 때까지 남아 있다.

`PARTIAL`을 유지한다. 최종 실행의 재방문 관성 p95는 19.04ms였다. 상단 첫 프로그램 링크와 중하단 첫 편집기 생성에 따른 긴 프레임이 남았다. Galaxy와 실제 손가락 입력 인수는 이번 에뮬레이터 검증 범위 밖이었다.

## 13. 관성 표시 추적과 편집기 후보

`ACTION_UP` 이후의 표시 구간에서 정지 뒤의 제출을 구분할 수 있도록 `--cpu --timeline --inertia`에 `afterReleaseThroughNextPresent`를 추가했다. 같은 프레임 번호의 스크롤 위치와 WebGL 펜스 등록을 맞춘다. 위치가 마지막으로 바뀐 프레임의 펜스 등록 이후 첫 Android 버퍼 표시를 찾아 끝점으로 삼는다. Android 버퍼에는 대응하는 JS 프레임 번호가 없어 끝점은 시각에 따른 추정이다. `afterRelease`에는 제스처별 정해진 관측 시간을 사용하고, 손을 뗀 시각부터 첫 버퍼까지의 지연을 프레임 간격과 함께 출력한다. 이미지 첫 진입에서는 메시지 옵션으로 바로 정렬해 중간 스와이프에서 먼저 이미지 카드를 노출하는 경우를 줄였다. [Android 관성 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

후보는 `InputDecoration`의 임시 항목·복사, 입력 설정의 반복 정규화, 편집기 동작별 반복 콜백 생성과 첫 브라우저 입력 요소 교체를 줄였다. 위젯 마운트와 IME 연결을 기존 순서에서 실행했다. Core 섹션 인계, Material 입력 장식 레이아웃, Demo 타입 검사와 Android 키보드의 `804`, 한글 조합·선택 검사가 통과했다.

| APK | PWA 빌드 ID | APK SHA-256 |
| --- | --- | --- |
| 기준 | `4669dc4e027621d941e6bd958ff1b6f6b559f25d31251e458222d8a9ade49d00` | `cfd16e74ca27f0273e9df742e6248d4248713b603cf82031084edac3cae12869` |
| 편집기 초기화 후보 | `3a193b11c7a41ae8c39c07f302e05379f9d982b566375f4363c8b9f402cfeb11` | `9f594a93d88aeae8ce819a72c406c7ffd81dcf40ca9600758362e073adeb1381` |

786×1602 하드웨어 WebGL2에서 첫 편집기 **Write something**은 손을 뗀 뒤 들어왔다. 기준·후보 계측 한 쌍에서 생성은 49.1 → 55.4ms, 실측은 12.8 → 14.1ms였다. 편집기 구간에 새 프로그램 링크는 없었다. 이 계측에 사용한 JS 제출 종료 시각으로 추정한 구간의 표시 p95는 상단 50.58 → 48.69ms(간격 4 → 3개), 중하단 118.17 → 102.58ms(18 → 25개)였다. 중하단의 33.3ms 이상 간격은 2 → 3개였다. 이때 중하단의 마지막 기록 위치는 3253 → 3428 논리 px였다. 첫 이미지 플링은 기준에서 처음 노출됐고 후보에서는 앞선 스와이프에서 노출됐다.

계측을 끄고 표준 11개 구간을 세 쌍 비교했다. 각 설치 APK 해시와 PWA ID, 하드웨어 WebGL2와 786×1602 래스터를 대조했다. 아래 표는 시작·종료 카드 목록이 일치한 비교만 사용한다. p95·p99와 첫 표시는 실행별 중앙값이고 33.3ms 이상 횟수와 간격 수는 합계다. CSS 대조는 세 쌍을 사용했다.

| 구간 | 카드 일치 | 첫 표시 (ms) | 전체 p95 (ms) | 전체 p99 (ms) | 최장 (ms) | 33.3ms 이상 / 간격 | 손을 뗀 뒤 p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 상단 첫 플링 | 3/3 | 250.58 → 265.23 | 85.68 → 66.03 | 85.68 → 66.03 | 115.50 → 67.65 | 6/13 → 6/11 | 85.68 → 66.03 |
| 중단 방향 전환 | 1/3 | 57.46 → 50.57 | 18.35 → 18.70 | 18.38 → 21.19 | 18.38 → 21.19 | 0/30 → 0/30 | — |
| 중하단 첫 플링 | 2/3 | 54.77 → 77.57 | 98.77 → 83.31 | 100.35 → 101.56 | 101.57 → 118.82 | 9/44 → 7/42 | 100.35 → 101.56 |
| 하단 방향 전환 | 2/3 | 62.26 → 74.03 | 25.58 → 22.16 | 34.30 → 30.58 | 35.61 → 31.30 | 1/57 → 0/58 | — |
| 이미지 접근 1·2 | 0/3 | — | — | — | — | — | — |
| 이미지 접근 3 | 3/3 | 96.29 → 82.41 | 34.80 → 36.97 | 49.03 → 48.63 | 53.82 → 55.56 | 15/171 → 22/167 | — |
| 이미지 접근 4 | 3/3 | 95.89 → 96.76 | 34.52 → 35.16 | 37.93 → 49.67 | 41.52 → 54.24 | 16/179 → 17/162 | — |
| 중하단 재방문 플링 | 0/3 | — | — | — | — | — | — |
| 하단 재방문 방향 전환 | 1/3 | 50.80 → 79.08 | 18.79 → 18.85 | 19.71 → 18.87 | 19.71 → 18.87 | 0/30 → 0/29 | — |
| CSS 대조 | — | — | 18.93 → 18.94 | 19.75 → 20.22 | 20.46 → 20.80 | 0/267 → 0/268 | — |

중하단의 손을 뗀 뒤 p95는 두 비교에서 101.57 → 84.29ms와 99.14 → 118.82ms였다. 세 번째 이미지 접근의 드래그 중 p95는 세 비교에서 34.46 → 43.39ms, 36.22 → 36.97ms, 33.47 → 34.26ms였다. 상단의 간격은 실행당 3–5개였고 두 APK에서 모두 목표를 넘었다. 이미지 접근의 반복 회귀에 따라 편집기 초기화 후보의 제품 소스를 되돌리고 기준 APK를 설치했다.

### 복구한 APK의 관성 재측정

복구한 기준 APK에서 WebGL·CPU 프로브를 끄고 이미지 첫 진입과 재방문을 포함한 `--timeline --inertia`를 한 번 완료했다. **Local and network images**는 이미지 플링 전에는 보이지 않았고 종료 뒤 표시됐다. CSS 대조의 p95는 18.95ms였다.

| 구간 | 손을 뗀 뒤 첫 버퍼 (ms) | 손을 뗀 뒤 p95 (ms) | 33.3ms 이상 / 간격 수 |
| --- | ---: | ---: | ---: |
| 상단 첫 플링 | 58.20 | 117.61 | 2/4 |
| 중하단 첫 플링 | 14.95 | 99.82 | 4/21 |
| 첫 이미지 플링 | 14.19 | 66.63 | 2/5 |
| 중하단 재방문 플링 | 1.76 | 34.15 | 2/33 |

별도 진단에서 펜스 등록과 표시 시각으로 추정한 관성 구간의 p95는 상단 67.10ms, 중하단 99.68ms, 첫 이미지 67.24ms, 중하단 재방문 47.89ms였다. 중하단에서 손을 뗀 139.75ms 뒤 첫 편집기 생성이 시작됐고 61.0ms를 썼다. 같은 프레임의 실측은 16.7ms였다. 손을 뗀 179.07–278.75ms 사이에 99.68ms 표시 간격이 있었고, 중하단에서 새 WebGL 프로그램 링크는 0회였다. 생성 구간의 V8 표본 52개에는 편집기·입력 장식·자식 요소 생성과 라인 높이용 CanvasKit 문단 준비가 포함됐다. 단일 생성 구간의 계측으로 제품 변경의 효과를 판정하지 않는다. [편집기 라인 높이 계산](Nelyx/src/framework/widgets/editable-text.ts)

기준 APK에서 단일·범위 슬라이더, `804` 입력, 한글 조합과 선택, 이미지 색상 추출을 다시 확인했다. 최초 표시·WebGL 복구·재진입의 주황색 픽셀은 각각 222,809개였다. 복구한 소스로 Core·Material·SDK와 Demo PWA·APK를 다시 빌드했고 위 표의 기준 빌드 ID와 APK SHA-256을 확인했다. Core 섹션 인계, Material 입력 장식, Demo 타입 검사를 통과했다. 임시 추적 파일과 시험 APK 사본을 정리했고 기존 Pixel 5는 Demo를 열어 두었다.

`PARTIAL`을 유지한다. 손을 뗀 뒤 화면이 움직이는 동안의 긴 간격을 재현했다. 상단의 첫 프로그램 링크와 중하단의 첫 편집기 생성이 남아 있고, Pixel 5의 33.33ms와 Galaxy의 16.7ms 인수가 완료되지 않았다.

## 14. Galaxy에서 현재 빌드 검증

Pixel 5에서 마지막에 복구한 PWA `4669dc4e027621d941e6bd958ff1b6f6b559f25d31251e458222d8a9ade49d00`을 Galaxy SM-S931N용 ARM64 디버그 APK로 다시 패키징했다. Cargo의 `aarch64-linux-android`와 Gradle의 `assembleArm64Debug`를 사용했다. 로컬 파일과 설치된 APK의 SHA-256은 `98cc4fa928b53846676416b66ef918e1cfc009f2526608231d689c19f96fc55f`로 일치했다. 실행 중인 PWA 빌드 ID도 확인했다. 화면은 1080×2340, WebView 157.0.8103.50의 뷰포트는 360×780 논리 px와 DPR 3, CanvasKit 래스터는 720×1460이었다. WebGL2와 Android 합성기는 Adreno 830을 사용했다. [Galaxy용 디버그 APK](sample/nelyx-demo-app/src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk)

첫 실행은 이미지 진입 전 자동 터치 명령에서 시간 초과로 종료됐다. 같은 빌드의 다음 무계측 실행에서 전체 `--inertia` 경로를 완료했다. **Local and network images**의 첫 노출을 확인했으며 CSS 대조의 표시 간격 p95와 최장은 각각 8.33ms였다. 표는 손을 뗀 뒤 정해진 관측 창을 집계했다.

| 구간 | p95 (ms) | 최장 (ms) | 33.3ms 이상 / 간격 수 |
| --- | ---: | ---: | ---: |
| 상단 첫 플링 | 16.66 | 108.32 | 2/105 |
| 중하단 첫 플링 | 16.66 | 108.31 | 1/67 |
| 첫 이미지 플링 | 16.66 | 91.65 | 3/64 |
| 중하단 재방문 플링 | 16.66 | 108.30 | 1/51 |

별도 계측에서 마지막 이동 제출 뒤의 첫 버퍼까지 추정한 구간을 집계했다. 이 실행의 중하단 첫 플링은 **Sliders**에서 **Switches**까지 도달했다. 중하단 첫 플링과 재방문의 관측 창에서 100ms 이상의 간격은 마지막 이동 뒤에 있었다. 이미지 첫 진입의 추정 구간에는 약 33.32ms 간격 두 건이 있었다.

| 구간 | 추정 관성 구간 p95 (ms) | 최장 (ms) | 33.3ms 이상 / 간격 수 |
| --- | ---: | ---: | ---: |
| 상단 첫 플링 | 16.66 | 25.00 | 0/109 |
| 중하단 첫 플링 | 8.33 | 16.67 | 0/63 |
| 첫 이미지 플링 | 16.66 | 33.32 | 2/45 |
| 중하단 재방문 플링 | 8.33 | 16.66 | 0/66 |

첫 이미지의 WebCodecs 디코딩 대기는 13.8ms, RGBA 복사는 4.0ms, CanvasKit 이미지를 등록하는 호출은 2.4ms였다. 960×1440 원본의 첫 텍스처 업로드는 5.4ms였다. 손을 뗀 247.48–280.80ms의 표시 간격에는 업로드 직후 첫 이미지 프로그램 링크가 겹쳤다. 그 프레임의 `flush()`는 15.7ms였고 링크 상태 조회가 13.4ms를 차지했다. [이미지 경로](Nelyx/skia/packages/web/src/webp-decode.ts)

동일한 APK에서 단일·범위 슬라이더의 느린 이동, 방향 전환, 취소 후 재드래그와 트랙에서 시작한 세로 스크롤을 확인했다. EditContext에서 Android 키보드 `804`, 한글 조합과 선택 위치 0·17을 확인했다. 이미지 색상 추출을 통과했고 첫 표시·WebGL 복구·재진입의 주황색 픽셀은 각각 229,044개였다. [Android 기능 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

### 첫 편집기에 도달하는 관성 경로

`--editor-entry-only`는 화면에 보이는 갤러리 목록의 하단을 기준으로 **Switches**의 스위치를 맞춘 뒤, 80 논리 px를 90ms 동안 밀어 첫 편집기에 진입한다. 자동 입력 전에는 첫 편집기가 가려져 있고, 끝난 뒤에는 **Write something**이 보이는지 검사한다. Galaxy에서 WebView 높이는 780이고 목록의 하단은 732였다. 계측 실행의 스위치 위치는 564.68이었다. [관성 재현 경로](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

첫 편집기 생성은 손을 뗀 65.64ms 뒤에 시작해 20.1ms를 썼고, 이어진 실측은 3.4ms였다. 추정 관성 구간의 p95는 16.66ms였으며 유효 간격 37개 중 한 건이 33.32ms였다. 그 간격은 손을 뗀 81.30–114.62ms에 걸쳐 편집기 생성과 실측에 겹쳤다.

같은 경로의 무계측 실행도 **Write something**에 도달했고 **Your message**까지 보였다. 스위치 위치는 564.64였고, 정해진 손 뗀 뒤 관측 창의 p95는 33.33ms, 최장은 91.67ms였다. 간격 48개 중 33.3ms 이상은 3개였다. 손을 뗀 60.22–101.88ms에는 41.66ms의 표시 간격이 있었다. CSS 대조의 p95는 8.33ms였다. 두 실행에서 종료 카드와 이동 거리가 달랐다.

Galaxy 성능 인수는 `PARTIAL`이다. 첫 편집기와 이미지 진입에서 손을 뗀 뒤의 긴 표시 간격이 남아 있고, 이전 APK와의 동일 경로 세 쌍 비교 및 실제 손가락 입력 확인이 남아 있다. Galaxy에는 위 ARM64 APK를 설치했고, 다시 실행해 갤러리 상단의 **Filled** 버튼과 실행 빌드 ID를 확인했다.

## 15. 관성 중 첫 편집기와 이미지 비용

Galaxy 기준 APK에서 스위치를 WebView y=564px에 맞춘 뒤 **Write something**으로 플링했다. 첫 편집기를 생성한 프레임의 전체 레이아웃은 19.2ms였고, 그 안에서 섹션 생성은 15.5ms, 섹션 실측은 3.4ms였다. 접근성 트리 갱신과 스냅샷 고정에 1.9ms, DOM 게시에 0.2ms가 이어졌다. 손을 뗀 뒤 72.39–105.71ms에 33.32ms 표시 간격이 있었다. 이 프레임에서는 편집기 마운트와 실측이 가장 큰 비용이었다. [프레임별 계측](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

첫 이미지 진입은 다른 작업을 거친다. 브라우저가 디코딩한 RGBA를 `MakeImage`로 WASM 래스터에 복사한 뒤, 카드가 그려질 때 텍스처를 올리고 첫 이미지 프로그램을 링크했다. 후보는 불투명 sRGB WebP의 브라우저 픽셀에서 `MakeLazyImageFromTextureSource`로 텍스처를 직접 생성한다. 텍스처를 만들 때 사용할 픽셀을 프레임 수명 동안 보관한다. 색상 추출이 쓰는 RGBA를 같은 픽셀에서 읽고, PNG와 부동소수점 RGBA 요청에만 읽기용 래스터를 만든다. [Nelyx 이미지 등록](Nelyx/skia/packages/web/src/library.ts) · [CanvasKit 텍스처 소스](https://github.com/google/skia/blob/61e7ca4e99062cdd0ab69445d5963fb3365778f6/modules/canvaskit/webgl.js#L300)

자동 터치를 여러 번 써도 마지막 입력이 목표 위치에 도달하면 정렬에 성공하도록 이미지와 편집기 검사에서 최종 위치를 다시 확인했다. 이미지 단독 검사의 `--inertia`는 전체 관성 검사와 같은 205ms 플링을 사용한다. [Android 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

| APK | 기준 SHA-256 | 텍스처 후보 SHA-256 |
| --- | --- | --- |
| Galaxy ARM64 | `98cc4fa928b53846676416b66ef918e1cfc009f2526608231d689c19f96fc55f` | `6fe5ed2b60b1369e83625a03f8210567067ab67693c716aa5d2b3608593b8be2` |
| Pixel 5 x86_64 | `cfd16e74ca27f0273e9df742e6248d4248713b603cf82031084edac3cae12869` | `af53b3e4b61bf4bdc068ecbbd641606aab9aef29d5c9289dc87167852d375574` |

기준 PWA ID는 `4669dc4e027621d941e6bd958ff1b6f6b559f25d31251e458222d8a9ade49d00`, 후보는 `274f63c0108cd5dbd9e996bedc5d845c9ba28e88d6ba4052cdb0e32d4bb27d5a`다. Chromium WebGL2에서 서로 다른 두 컨텍스트의 8개 비교에 분수 위치, 클리핑, 선형·밉맵 필터, DPR 1·2를 포함했다. 비교한 픽셀 바이트가 모두 일치했다.

Galaxy 계측 한 쌍에서 **Text fields**, **Write something**, **Your message**로 시작해 **Local and network images**에 도달했다. WASM 이미지 등록 호출 2.7ms는 텍스처 소스 등록 0.4ms로 바뀌었다. 첫 GPU 업로드는 3.6 → 4.7ms, 그 프레임의 CanvasKit 제출은 17.5 → 11.8ms였다. 첫 이미지 프로그램의 링크 상태 대기는 15.8 → 10.2ms였다. 마지막 이동 제출에 대응하는 것으로 추정한 버퍼까지 p95는 두 실행 모두 16.66ms였고, 33.3ms 이상 간격은 61개 중 1 → 0개였다. 이 비교에는 CPU와 WebGL 프로브가 켜져 있었다.

WebGL·CPU 프로브를 끄고 기기별로 새 프로세스의 `--timeline --inertia --image-entry-only`를 세 쌍 실행했다. Galaxy의 시작·종료 카드는 세 쌍 모두 일치했고, Pixel 5는 한 쌍이 일치했다. 표에는 일치한 쌍만 포함했다. p95·p99는 실행별 중앙값이고, 최장과 간격 수는 전체에서 집계했다. 손을 뗀 뒤 고정된 950ms 관측 창을 사용했으므로 스크롤이 정지한 뒤의 버퍼도 포함될 수 있다.

| 첫 이미지 플링 | 카드 일치 | 손을 뗀 뒤 p95 (ms) | p99 (ms) | 최장 (ms) | 33.3ms 이상 / 간격 수 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Galaxy | 3/3 | 16.66 → 8.33 | 83.32 → 83.32 | 91.66 → 116.65 | 8/198 → 7/186 |
| Pixel 5 | 1/3 | 83.77 → 48.31 | 83.77 → 48.31 | 83.77 → 48.31 | 2/6 → 4/6 |

Galaxy의 쌍별 p95는 16.66 → 8.33ms, 16.67 → 41.66ms, 16.66 → 8.33ms였다. CSS 대조는 여섯 실행 모두 8.33ms였다. Pixel 5의 CSS 대조 p95는 기준 20.18ms, 후보 19.83ms였고, 일치한 이미지 비교의 관성 간격은 각각 6개였다.

두 기기에서 단일·범위 슬라이더, Android 키보드 `804`, 한글 조합과 선택, 이미지 색상 추출과 WebGL 복구를 통과했다. 최초 표시·복구·재진입 화면의 주황색 픽셀 수는 Galaxy에서 229,105·228,867·229,105개, Pixel 5에서 222,812·222,709·222,812개였다. [Android 기능 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

Chromium에서 같은 CanvasKit으로 프리멀티플라이드 RGBA, 스트레이트 RGBA, 원본 형식, 부동소수점 RGBA와 PNG의 바이트가 기존 래스터 경로와 모두 일치했다. 코덱과 첫 프레임을 해제한 뒤에도 두 번째 프레임을 읽을 수 있었다. 읽은 바이트 배열을 수정해도 같은 프레임의 다음 읽기 값은 유지됐다. 투명 WebP의 알파 값과 480×720 요청 크기 디코딩도 확인했다.

후보를 설치한 Pixel 5의 편집기 단독 플링에서 첫 입력창 생성은 손을 뗀 73.14ms 뒤 시작해 64.9ms를 썼다. 이 구간의 V8 표본 55개에는 입력 바인딩과 구성, 장식 구성, 상속 위젯 조회와 마운트가 포함됐다. 이미지 등록 변경과 별개로 첫 편집기 프레임의 비용이 남아 있었다.

Galaxy에서 같은 후보의 첫 편집기 생성은 16.6ms, 전체 레이아웃은 23.1ms, 접근성 갱신과 게시 합계는 3.1ms였다. 생성 구간의 V8 표본 72개에는 여러 엘리먼트의 빌드·마운트와 렌더 객체 생성·부착이 있었다. 이 실행에서 이동 중 추정한 표시 간격의 최장은 41.65ms였다. 두 기기의 운영체제 접근성 서비스는 검사 시 꺼져 있었고 앱의 접근성 트리 게시를 계측했다.

### 표준 11개 구간 비교

Galaxy와 Pixel 5에서 기준과 후보를 번갈아 설치해 세 쌍의 FrameTimeline을 수집했다. 설치 해시, 실행 빌드 ID, 하드웨어 렌더러 및 래스터를 맞췄다. Galaxy 기준 실행 한 건은 보조 `gfxinfo` 명령이 시간 초과됐지만 FrameTimeline 11개 구간이 모두 수집됐다. Pixel 5 기준 실행 한 건은 DevTools 포트 연결이 시간 초과되어 그 쌍을 다시 실행했다.

첫 표시, p95·p99, 손을 뗀 뒤 p95는 시작·종료 카드가 일치한 실행별 중앙값이다. 최장과 33.3ms 이상 횟수는 일치한 실행 전체에서 집계했다.

| 기기 | 구간 | 카드 일치 | 첫 표시 (ms) | p95 (ms) | p99 (ms) | 최장 (ms) | 33.3ms 이상 / 간격 | 손을 뗀 뒤 p95 (ms) |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Galaxy | 상단 첫 플링 | 1/3 | 48.55 → 50.36 | 16.66 → 16.66 | 25.00 → 33.33 | 25.00 → 33.33 | 0/84 → 1/82 | 16.66 → 16.66 |
| Galaxy | 중단 방향 전환 | 3/3 | 43.50 → 52.51 | 16.65 → 8.33 | 49.99 → 16.66 | 58.33 → 50.00 | 3/155 → 1/151 | — |
| Galaxy | 중하단 첫 플링 | 1/3 | 45.03 → 59.70 | 16.66 → 16.66 | 24.99 → 24.99 | 24.99 → 24.99 | 0/63 → 0/64 | 16.66 → 8.33 |
| Galaxy | 하단 방향 전환 | 0/3 | — | — | — | — | — | — |
| Galaxy | 이미지 접근 1 | 0/3 | — | — | — | — | — | — |
| Galaxy | 이미지 접근 2 | 1/3 | 66.53 → 36.27 | 8.33 → 16.66 | 24.99 → 24.99 | 25.00 → 25.00 | 0/131 → 0/131 | — |
| Galaxy | 이미지 접근 3 | 2/3 | 54.52 → 53.77 | 8.33 → 8.33 | 37.48 → 29.16 | 41.66 → 41.66 | 5/260 → 3/264 | — |
| Galaxy | 이미지 접근 4 | 3/3 | 36.81 → 39.17 | 16.66 → 16.66 | 16.66 → 16.66 | 16.67 → 25.00 | 0/375 → 0/403 | — |
| Galaxy | 중하단 재방문 플링 | 0/3 | — | — | — | — | — | — |
| Galaxy | 하단 재방문 방향 전환 | 0/3 | — | — | — | — | — | — |
| Galaxy | CSS 대조 | 3/3 | — | 8.33 → 8.33 | 8.33 → 8.33 | 8.33 → 8.33 | 0/538 → 0/535 | — |
| Pixel 5 | 상단 첫 플링 | 3/3 | 312.22 → 203.39 | 103.58 → 99.32 | 103.58 → 99.32 | 133.43 → 119.21 | 7/17 → 7/19 | 103.58 → 99.32 |
| Pixel 5 | 중단 방향 전환 | 0/3 | — | — | — | — | — | — |
| Pixel 5 | 중하단 첫 플링 | 0/3 | — | — | — | — | — | — |
| Pixel 5 | 하단 방향 전환 | 1/3 | 103.75 → 60.01 | 31.09 → 33.84 | 31.44 → 36.22 | 31.44 → 36.22 | 0/23 → 2/28 | — |
| Pixel 5 | 이미지 접근 1 | 0/3 | — | — | — | — | — | — |
| Pixel 5 | 이미지 접근 2 | 0/3 | — | — | — | — | — | — |
| Pixel 5 | 이미지 접근 3 | 1/3 | 104.66 → 96.69 | 44.90 → 45.65 | 57.24 → 50.83 | 57.24 → 50.83 | 13/40 → 11/43 | — |
| Pixel 5 | 이미지 접근 4 | 3/3 | 104.67 → 106.88 | 41.05 → 42.85 | 50.70 → 48.97 | 52.31 → 52.13 | 34/130 → 28/131 | — |
| Pixel 5 | 중하단 재방문 플링 | 0/3 | — | — | — | — | — | — |
| Pixel 5 | 하단 재방문 방향 전환 | 1/3 | 57.44 → 53.72 | 31.99 → 33.27 | 34.08 → 35.81 | 34.08 → 35.81 | 1/24 → 1/25 | — |
| Pixel 5 | CSS 대조 | 3/3 | — | 20.55 → 21.11 | 29.91 → 30.32 | 31.63 → 32.61 | 0/266 → 0/267 | — |

Pixel 5의 마지막 이미지 접근 p95는 37.50 → 42.85ms, 41.05 → 40.00ms, 48.71 → 44.19ms였다. 같은 구간의 전체 33.3ms 이상 간격은 34 → 28개였다. 양쪽 APK에서 상단 첫 플링과 마지막 이미지 접근의 표시 p95가 Pixel 5 목표 33.33ms를 넘었다.

Galaxy의 최종 `--timeline --inertia` 실행은 첫 이미지와 재방문에 도달했고 8개 구간을 수집했다. 손을 뗀 뒤 관측 창에서 상단, 중하단 첫 진입과 재방문의 p95는 각각 16.66ms였다. 첫 이미지의 p95는 41.66ms였고 57개 간격 중 3개가 33.3ms 이상이었다. CSS 대조의 p95는 8.33ms였다.

브라우저 픽셀의 중간 WASM 복사를 제거한 텍스처 경로를 유지한다. 양쪽 기기에서 설치 APK의 해시와 PWA ID를 확인하고 갤러리 첫 화면을 열어 두었다. 전체 스크롤 성능은 `PARTIAL`이다. 첫 편집기 마운트와 첫 프로그램 링크에 걸리는 시간, Galaxy의 간헐적인 긴 프레임 및 실제 손가락 입력 확인이 남아 있다.

## 16. 중간 마무리

2026-11-22 사용자 요청으로 `PAUSED / PARTIAL`에서 멈췄다. 작업 트리와 설치 빌드는 §15의 검증 시점과 같다. 마지막 확인에서 `emulator-5554`와 Galaxy SM-S931N 모두 §15의 텍스처 경로가 반영된 PWA와 APK로 갤러리 첫 화면을 표시했다. 이 중간 마무리에서는 인수 기록을 갱신했다. [설치 해시와 측정 기록](#15-관성-중-첫-편집기와-이미지-비용)

- **Pixel 5**는 상단 첫 플링의 동기 WebGL 프로그램 링크와 중하단 첫 편집기의 마운트·실측이 다음 조사 지점이다. 새 후보는 §15의 설치 APK를 기준으로 상단과 편집기 단독 경로에서 각각 원인을 확인하고, 표준 11개 구간의 세 쌍 비교로 판정한다. 활성 이동 구간 p95 33.33ms 인수가 남았다.
- **Galaxy**는 첫 이미지 단독 진입의 손을 뗀 뒤 p95 중앙값이 16.66 → 8.33ms였고 전체 관성 실행의 해당 구간은 41.66ms였다. p95 16.7ms, 반복 끊김 해소, 실제 손가락의 범위 슬라이더와 방향 전환 확인이 남았다.
- **이미지와 Picture**는 다른 색 공간·투명 자산의 기기 회귀와 빠른 왕복 메모리 확인이 남았다. 화면 밖 Picture 조사는 §5와 §12에 기록한 관측을 재개 기준으로 삼는다.
