# W5 · Nelyx Android WebView 스크롤 개선 계획

**2026-11-21 · PLANNED · 기준 브랜치 `tauri-backend` · Nelyx `856b16ba`**

목표는 Demo의 **All components**에서 첫 플링, 연속 방향 전환, 하단 이미지까지의 왕복을 부드럽게 만드는 것이다. Pixel 5 에뮬레이터의 목표는 각 활성 이동 구간의 표시 간격 p95 **33.33ms 이내**, Galaxy는 **16.7ms 이내**이며 33.3ms 이상의 반복 끊김도 해소해야 한다. 제품 경로는 Tauri WebView의 CanvasKit WebGL2다. 슬라이더 추종, 실제 IME 연결, 접근성, 클리핑과 이미지 복구까지 인수 범위에 포함한다. [W4 종료 기록](work4.md)

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

- [ ] `component-image.webp`는 **960×1440, 단일 프레임, 109,750바이트**다. Demo의 720×220은 위젯 배치 크기다. 원본 크기로 디코딩할 때 RGBA 한 장은 약 5.27MiB다. `getNextFrame`에서 실제 목표 크기, 임시 표면 수, 디코드·스냅샷 시간, 첫 텍스처 업로드를 기록하고 이미지가 처음 보이는 프레임에 맞춘다. [크기 결정](Nelyx/src/hosting/images.ts) · [자산](sample/nelyx-demo-app/assets/component-image.webp)
- [ ] 단일 프레임이고 목표 크기가 원본과 같을 때 디코딩된 이미지를 직접 등록한다. 코덱이 보유한 이미지와 호출자에게 반환한 프레임의 소유권을 명시한다. `makeImageAtCurrentFrame()`에서 얻은 핸들과 코덱 소유의 `still`을 각각 다루고, 반복 호출·실패·선행 코덱 해제·마지막 lease 반환에서 각 핸들을 한 번만 해제한다. 기존 리사이즈와 애니메이션의 크기·순서·지연 및 바이트 예산을 검증한다.
- [ ] 임시 표면 생성을 1회에서 0회로 줄였는지 확인한다. 첫 업로드로 비용이 옮겨갔는지, 색 추출·투명도·색 공간, WebGL 손실 후 복구된 이미지 픽셀, 빠르게 떠났다가 돌아올 때의 메모리와 표시 p95를 비교한다. 대형 이미지의 브라우저 디코더·지연 업로드는 이 비교에서 디코드 또는 업로드가 병목으로 남을 때 별도 후보로 다룬다.

### W5-02 · 중하단 첫 입력창의 필수 작업 줄이기

- [ ] W4 §27의 `Write something` 첫 진입에서 섹션 생성, 입력 장식의 dry/실제 레이아웃, 슬롯별 baseline 조회와 문단 배치를 같은 프레임으로 대응시킨다. 입력창 두 개의 실제 슬롯 구성을 기록한다. 이 Demo의 기본 입력창에는 아이콘이 없는 경우가 있어, 아이콘 전용 개선은 해당 실행의 이득으로 계산할 수 없다. [Demo 편집기](sample/nelyx-demo-app/src/components.ts) · [장식 구성](packages/material/src/input-decorator.ts)
- [ ] baseline을 읽지 않는 아이콘·컨테이너 슬롯은 크기만 계산하도록 장식의 내부 측정을 바꾼다. 입력·힌트·라벨·보조문구·카운터에서 위치 계산에 쓰는 baseline은 유지한다. 슬롯별 비용이 작고 생성이 지배적이면 첫 마운트의 중복 장식 구성이나 동일 제약의 문단 계산을 호출 스택에서 특정해 그 연산만 제거한다. 위젯 생성·빌드·콜백 순서와 편집기 연결 시점을 보존한다.
- [ ] RTL, 글자 배율 변경, 단일·여러 줄, 오류·떠 있는 라벨의 크기와 위치, 포커스·한글 조합·선택 좌표를 확인한다. 중하단 첫 플링과 재방문에서 생성 수, 레이아웃 시간, 표시 간격을 함께 비교한다.

### W5-03 · 재방문 때 화면 밖 Picture 재생 줄이기

- [ ] 재방문에서 같은 Picture의 기록·컴파일·재생 횟수와 변환, 유효 클립, 실제 그리기 비용을 관찰한다. 이미 Sliver에서 제외한 자식을 빼고, **제출되는 Picture 중 확실하게 화면 밖인 것**이 얼마나 남는지 계산한다. W4 §20에서 이동 그림의 연속 소수 픽셀 위치 일치는 0회였다. 기존 SkPicture 재사용을 출발점으로 삼는다. [W4 §20](work4.md#20-이동하는-picture의-래스터-재사용-조건)
- [ ] 제외할 작업이 확인되면 불변 Picture와 함께 보수적인 지역 경계를 한 번 보관하고, 재생 시 현재 변환·클립으로 완전히 벗어나는 경우만 건너뛴다. 처음에는 유한 경계와 축 정렬 이동을 증명할 수 있는 잎에 적용한다. 그림자·필터·backdrop·역채움·원근·알 수 없는 경계는 원래대로 재생한다. 상태 명령과 리소스 수명은 유지하고, 역스크롤 때는 가시성을 다시 판정한다.
- [ ] DPR 1·2, 부분 노출 버튼, 소수 좌표, 중첩 클립과 역방향에서 기준 픽셀을 대조한다. 회피한 draw 수, 경계 계산 시간, `native-replay`, 표시 p95를 함께 잰다. 화면 밖 재생이 드물면 이 단계는 조사 결과로 닫는다.

### W5-04 · 첫 링크와 표시 지연의 원인에 맞춰 제출 경로 선택

- [ ] 상단에서 입력 수신, 장면 준비, 프로그램별 최초 링크, native flush, fence 삽입·반환과 첫 버퍼 표시를 시간순으로 맞춘다. Ganesh의 GL flush는 조건부다. 프레임별로 실제 GL flush 호출 위치·횟수와 소요 시간을 확인한다. GPU 대기 중 새 입력이 온 경우에는 준비 프레임의 입력 번호가 실제 제출 때 얼마나 오래됐는지도 기록한다. [Nelyx 프레임 진단](Nelyx/src/ui/frame-diagnostics.ts) · [Flutter의 표면별 제출](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/compositing/offscreen_canvas_rasterizer.dart#L73)
- [ ] **명령 선택이 원인이면** Nelyx 계측에서 같은 프로그램을 처음 사용하는 카드와 이후 재사용하는 카드를 묶어 의미가 동등한 GPU 프리미티브를 선택한다. 새 프로그램이 처음 필요한 다음 카드까지 추적한다. W4에서 회귀한 호 하나의 교체, 시작 시 일괄 워밍업, 작은 경로 전체의 렌더러 전환은 기존 대조 결과로 사용한다.
- [ ] **제출 후 표시 대기가 지배적이면** 동일한 Nelyx 장면으로 온스크린 직접 제출과 단일 오프스크린 WebGL2 → ImageBitmap → 표시 캔버스를 비교한다. 지원 여부를 확인하고, 동시에 보유하는 비트맵·대기 장면 수를 제한한다. 늦게 도착한 이전 크기·세대의 비트맵, 뷰 종료, context loss, 소비 전 교체 시 해제를 검증한다. 비트맵 생성·전달 비용을 포함한 표시 지연이 줄 때만 제품 후보로 삼는다. 중복 flush가 실제 병목일 때에는 별도 후보에서 fence 전후 명령 순서와 GPU 완료 후 lease 반환을 검증한다. [Flutter 표시 경로](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/lib/web_ui/lib/src/engine/compositing/offscreen_canvas_rasterizer.dart#L73) · [브라우저 프레임 콜백](Nelyx/sdk/src/backends/browser/services.ts)

## 4. 인수와 종료

- [ ] Nelyx 제품 후보는 한 가지씩 기준 APK와 번갈아 세 쌍 비교한다. WebView 버전, WebGL2 표면, 래스터 크기와 접근성 설정을 맞춘다. 같은 제스처 후에도 이동 거리가 달라질 수 있으므로 구간별 시작·종료 카드도 확인한다. 새 프로세스의 첫 방문과 같은 프로세스의 재방문을 나눈다. W4의 11개 구간에서 첫 버퍼 지연, 간격 표본 수, p95·p99·최장, 33.3ms 이상 횟수를 기록한다. 앱 내부 프로브는 원인 분석 실행에서 켠다. 효과 판정은 프로브를 끄고 Perfetto로 수행한다. CSS 대조도 함께 흔들리거나 표본이 희박하면 해당 비교의 한계를 남긴다.
- [ ] Pixel 5는 각 활성 이동 구간 p95 ≤ 33.33ms를 확인한다. Galaxy는 동일 기기·WebView·주사율·화면에서 기준과 비교해 p95 ≤ 16.7ms와 반복 끊김 해소를 확인하고, 실제 손가락으로 범위 손잡이와 방향 전환을 확인한다. 일부 단계만 빨라지고 다른 구간의 표시나 입력이 반복 악화되면 해당 후보를 되돌린다.
- [ ] 단일·범위 슬라이더의 느린 이동, 방향 전환, 취소 뒤 재드래그, 트랙에서 시작한 세로 스크롤, IME `804` 입력과 복귀, 로컬 이미지의 컨텍스트 복구, 접근성 값·화면 위치, 클리핑 픽셀을 확인한다. 정상 GPU 표면, 같은 래스터 해상도와 콘텐츠를 인수 조건으로 둔다. CPU 렌더링 전환이나 해상도 하향으로 기준을 맞추는 경로는 제외한다.
- [ ] 후보별 변경 파일과 APK·PWA·런타임 식별값, 결과와 채택 여부를 이 문서에 갱신한다. 기기 또는 실제 입력 확인이 남으면 `PARTIAL`로 기록한다. 자동 검사 제한은 각 20분이며 임시 추적과 시험 산출물은 실행 종료 시 정리한다.

Nelyx 재현은 아래 명령을 사용한다. Android SDK·JDK와 네이티브 Trace Processor 준비 및 변경한 패키지를 러너에 공급하는 순서는 [W4 재현 절차](work4.md#4-재현과-검증-경로)를 따른다.

```powershell
npm.cmd run build:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
$env:NELYX_TRACE_PROCESSOR = (Get-Command trace_processor_shell.exe).Source
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --timeline
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --cpu
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --controls
```
