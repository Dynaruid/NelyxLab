# Nelyx Demo Android 빠른 스크롤 끊김 개선

**2026-11-21 · `tauri-backend` · PAUSED / PARTIAL**

`sample/nelyx-demo-app`의 **All components**에서 빠르게 밀거나 손을 떼지 않고 방향을 바꿀 때 카드가 한 번에 이동하듯 보인다. 특히 앱을 열고 아직 만들지 않은 카드를 처음 지날 때 긴 프레임이 남는다. 빠른 스크롤을 고치는 과정에서 범위 슬라이더 손잡이가 뒤늦게 따라붙는 증상도 보고됐다. 목표는 첫 진입과 반복 스크롤 모두에서 안정적인 60fps를 달성하고, 범위 슬라이더와 입력창의 반응을 유지하는 것이다. Android는 [W3의 Vite PWA와 Tauri 경로](work3.md)를 사용한다.

## 1. 기존 구조와 병목

| 경로 | 현재 동작과 확인할 지점 |
| --- | --- |
| 섹션 생성과 유지 | 가변 높이 목록은 이전에 생성한 카드를 캐시 범위에서 유지한다. 화면 밖에서 처음 필요한 카드는 브라우저의 `requestIdleCallback` 예산 안에서 준비한다. 화면에 들어오면 준비한 트리를 한 번 이어받고, 실제 크기와 스크롤 기준점을 확정한다. 유휴 예산이 없거나 준비가 끝나기 전에 화면이 도달하면 필수 레이아웃이 그 작업을 맡는다. Demo의 이미지와 입력창 구역은 호스트 연결이 필요하므로 현재 일반 생성 경로를 쓴다. [섹션 레이아웃](Nelyx/src/framework/rendering/sliver-section-list.ts) · [분할 준비와 인계](Nelyx/src/framework/widgets/subtree-preparation.ts) · [Demo 적용 범위](sample/nelyx-demo-app/src/components.ts) |
| 입력 좌표 | 웹의 기본 입력창은 포커스된 경우에만 IME용 커서·선택 좌표를 계산한다. 스크롤 중에도 브라우저에 역할·값·화면상 위치를 전달하고, 포커스 시 최신 입력 좌표를 전달한다. [프레임 경로](Nelyx/src/framework/widgets/root.ts) · [브라우저 입력과 접근성](Nelyx/sdk/src/backends/browser/interaction.ts) |
| WebGL 제출 | `WebSkiaLibrary.submit()`은 장면을 재생하고 `surface.flush()`를 호출한 뒤 GPU fence를 등록한다. 따라서 뒤에서 fence를 확인하더라도, 처음 사용하는 셰이더의 컴파일 상태 조회나 텍스처 업로드가 제출 호출을 길게 만들 수 있다. 에뮬레이터의 긴 프레임에서 셰이더 상태 조회와 긴 제출 시간이 함께 관측됐다. [CanvasKit 제출 경로](Nelyx/skia/packages/web/src/library.ts) |

Doroti의 `RenderSectionList`에서 가시 범위와 보존 범위를 구분하는 구조를 가져왔다. 남은 렌더링 작업은 Doroti의 `SkiaSceneRenderer`가 래스터 캐시 준비에 시간·픽셀 예산을 두는 방식을 참고한다. Nelyx에서는 기존 렌더러와 GPU 리소스 소유권을 기준으로 적용 가능 범위를 판단한다.

## 2. 2026-11-21 기준 측정 결과

Galaxy SM_S931N의 120Hz 환경에서 Android 터치 이벤트를 주입해 이전 빌드와 현재 빌드를 각각 한 차례 비교했다. 표는 `dumpsys gfxinfo`의 `DisplayPresentTime`에서 읽은 이동 중 프레임 간격이다. 두 빌드 모두 화면 맨 위에서 시작했고, 각 동작 사이에 첫 카드로 돌아온 뒤 다음 위치로 이동했다. 이번 비교의 입력은 자동화였으며 실제 손가락 체감과 화면 스캔아웃은 미검증이다.

| Galaxy 동작 | 표시 간격 p95, 이전 → 현재 | 최장 표시 간격, 이전 → 현재 |
| --- | ---: | ---: |
| 상단 첫 플링 | 16.7 → 25.0ms | 25.0 → 33.3ms |
| 중하단 첫 플링 | 25.0 → 33.3ms | 33.3 → 41.7ms |
| 중단 빠른 방향 전환 | 16.7 → 16.7ms | 25.0 → 25.0ms |
| 하단 빠른 방향 전환 | 16.7 → 8.3ms | 33.3 → 25.0ms |
| 중하단 재방문 플링 | 16.7 → 16.7ms | 25.0 → 33.3ms |
| 하단 재방문 방향 전환 | 16.7 → 8.3ms | 25.0 → 16.7ms |

- **Pixel 5 x86_64 에뮬레이터**에서 호스트 GPU로 같은 PWA를 실행했다. 느린 터치와 빠른 터치를 섞어 첫 카드에서 하단의 로컬 이미지까지 이동하고 돌아왔다. 빠른 이동의 WebView 제출 간격은 p50 16.67ms, p95 33.33ms, 최대 116.67ms였다. 첫 플링의 긴 JavaScript 프레임 하나에서 레이아웃 48.1ms와 WebGL 제출 81.7ms가 같은 프레임에 걸렸다. 중하단의 다른 긴 프레임에서는 빌드 20.1ms와 레이아웃 30.7ms가 관측됐다. 이 수치는 에뮬레이터의 진단 결과다.
- **Android 입력**은 에뮬레이터에서 입력창을 터치한 뒤 `804`를 입력하고 첫 카드로 돌아오는 동작을 확인했다. 범위 슬라이더는 빠른 왕복 이후에도 시작 손잡이가 25에서 32로 바뀌고 반대쪽 값 75를 유지했다. 느린 드래그의 기록 영상에서 WebView 입력 위치 표시와 손잡이의 차이는 이동 프레임 200개 기준 p95 1.09 CSS px, 최대 18.19 CSS px였다. [범위 슬라이더 회귀 검사](packages/material/eng/check-range-slider-hover.mjs)
- **Core와 Chromium**에서 유휴 예산이 없으면 준비를 건너뛰고, 준비된 카드는 실제 가시 레이아웃에서 한 번만 이어받으며, 역방향에서 State를 재사용하는 것을 확인했다. Chromium의 스크롤 클리핑 픽셀 검사는 DPR 1과 2에서 통과했다. [섹션 준비 검사](Nelyx/eng/check-section-preparation.mjs) · [클리핑 픽셀 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs)

Galaxy arm64와 에뮬레이터 x64에 설치한 디버그 APK의 PWA 빌드 ID는 `080f003a07527fb41c8e0aa5ff5317f11a852fcb22460f554a4f6fefb68ff39a`이다. Galaxy의 하단 방향 전환은 짧아졌고, 첫 플링과 중하단 재방문 플링에는 긴 간격이 남았다.

## 3. 구현 및 검증 항목

### W4-01 · 처음 보는 카드에서 발생하는 필수 레이아웃 비용 줄이기

- [x] `createChild`부터 실측과 스크롤 보정까지 추적했다. 준비 후보를 건너뛰면 필요한 슬롯을 일반 경로에서 만들고, 같은 슬롯의 생산이 진행 중이면 기존 커서를 끝까지 진행해 인계한다. 이미지와 편집기는 호스트 연결이 필요하며 가시 레이아웃에서 생성한다. [Sliver 요소](Nelyx/src/framework/widgets/sliver.ts) · [섹션 높이 인덱스](Nelyx/src/framework/rendering/section-extent-index.ts)
- [x] 앞선 카드의 높이 변화로 기준점이 이동하면 viewport 끝에서 생길 잘못된 카드 생성을 먼저 막는다. 아직 깨끗한 활성 카드의 실제 BoxConstraints와 크기 의존성이 같은 경우 직전 레이아웃을 사용한다. 보통 프레임의 제출 직후 브라우저가 유휴 시간을 제공하면 새 준비 후보도 한 프레임 일찍 작업할 수 있다. 입력·필수 작업, 수명주기 및 가시 배치 검사는 기존 소유자에서 수행한다. [섹션 레이아웃](Nelyx/src/framework/rendering/sliver-section-list.ts) · [유휴 준비 예약](Nelyx/src/hosting/runtime.ts)
- [x] 같은 터치 경로에서 필수 생성·준비 후 게시·보존 카드 재사용과 레이아웃 시간을 기록했다. 중하단의 첫 방문에서 필수 레이아웃이 긴 경우가 남았다. [Pixel 5 재검증](#5-pixel-5-재검증)

### W4-02 · 새 콘텐츠의 WebGL 제출 비용 줄이기

- [x] Picture 기록 뒤 장면 재생과 `surface.flush()`가 이뤄지고, 그 다음 fence 등록과 0ms 확인이 이어지는 경로를 확인했다. 계측을 켰을 때 재생·flush·fence 등록 시간을 각각 기록한다. [Web Skia](Nelyx/skia/packages/web/src/library.ts) · [프레임 계측](Nelyx/src/ui/frame-diagnostics.ts)
- [x] 위치 이동만 감싼 레이어는 기존 Picture를 좌표 이동과 함께 재생한다. 래스터 크기가 같으면 WebGL Surface를 재사용하며, CPU 이미지 코덱의 임시 래스터 버퍼는 스냅샷 생성 뒤 CanvasKit의 `dispose()`로 해제한다. Chromium에서 DPR 1·2의 스크롤 클리핑 픽셀을 확인했다. [장면 재생](Nelyx/src/ui/scene.ts) · [클리핑 픽셀 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs)
- [x] 두 변경을 함께 빌드해 첫 플링과 재방문을 비교했다. 첫 플링의 WebGL 제출과 재방문 중 입력 대기에 긴 간격이 남았다. [Pixel 5 재검증](#5-pixel-5-재검증)
- [x] CanvasKit `m153-nelyx-paragraph.8`의 WebGL 그리기 프로그램은 vertex와 fragment 셰이더의 컴파일을 먼저 요청하고 링크 상태를 확인한다. 링크에 성공한 프로그램만 uniform과 실제 그리기에 사용한다. [소스와 빌드 고정 정보](Nelyx/skia/eng/source-build/canvaskit.lock.json) · [성공 및 실패 경로 검사](Nelyx/skia/eng/source-build/check-webgl-shader-validation.mjs)

### W4-03 · Android에서 스크롤과 입력 인수

- [x] Pixel 5에서 첫 플링, 관성 이동, 한 번의 연속 터치로 중단·하단 방향 전환, 재방문과 첫 카드부터 로컬 이미지까지 전체 왕복을 실행했다. Android에 터치를 주입해 키보드를 열고 텍스트를 입력한 뒤 화면을 복귀했다.
- [ ] Galaxy를 사용할 수 있을 때 동일 기기·주사율·화면 크기·WebView에서 이전 빌드와 개선 빌드를 비교한다. 동작 경로와 입력 시간을 고정하고 각 경우를 같은 횟수로 반복한다. 실제 손가락으로도 끊김과 슬라이더 추종을 확인한다.
- [x] `FrameDiagnostics`의 입력 대기·레이아웃·페인트·접근성·제출과 Android 표시 간격을 각각 읽었다. 활성 이동 구간의 60fps 판정 기준은 표시 간격 p95 16.7ms 이내와 33.3ms 이상의 반복 끊김 해소다. p99와 최장 간격도 함께 남긴다. Galaxy 120Hz의 VSync 간격은 약 8.33ms다. 표시 시각을 얻지 못한 실행은 제출 시간과 기능 확인까지만 기록한다.
- [x] 느린 드래그와 빠른 방향 전환에서 시작·끝 손잡이의 최종 값과 터치 취소 뒤 새 드래그를 확인했다. 입력 위치와 손잡이 위치를 영상으로 비교했다. 로컬 이미지, 클리핑, 브라우저 접근성의 값과 영역, Android 키보드 입력을 확인했다.

## 4. 재현과 검증 경로

검증 순서는 코드·호출 경로 분석, 가설과 변경 적용, 같은 조건의 실행 비교 순이다. Windows PowerShell에서 Android SDK와 JDK를 먼저 설정한다. 준비와 기기별 명령은 [Demo Android 실행 가이드](sample/nelyx-demo-app/README.ko.md)를 따른다. Core·SDK·Skia를 수정한 경우 갱신된 `dist`를 `npm.cmd run prepare:sample -- web sample/nelyx-demo-app`으로 러너에 공급한 뒤 Android 빌드를 만든다.

```powershell
adb devices -l
npm.cmd run build:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
```

Galaxy를 다시 확인할 때는 `--architecture arm64`로 빌드하고 `--device`에는 `adb devices -l`에 표시된 Galaxy 시리얼을 사용한다. APK 매니페스트와 실행 중인 WebView의 `build.json`을 대조해 실제로 같은 PWA를 실행하는지 확인한다.

전체 왕복은 화면 상단의 **Filled** 버튼부터 하단의 **Local and network images** 카드까지 이동한 뒤 돌아온다. 앞선 비교에서는 약 1,180ms 느린 스와이프와 약 205ms 빠른 스와이프를 사용했다. 플링과 방향 전환은 터치 시점과 이동 경로를 함께 고정하고, 첫 진입과 재방문을 구분한다.

Pixel 5 API 33의 1080×2340 세로 화면에서 Android 주입 경로를 다시 실행할 수 있다. `ANDROID_SERIAL`을 생략하면 `emulator-5554`를 선택한다. 기본 3회 실행하며 `NELYX_SCROLL_RUNS`로 1–5회를 지정할 수 있다. 기본 실행은 Android 표시 간격을 읽는다. `--gl`은 WebGL 호출을, `--cpu`는 WebGL 호출과 프레임 단계 시간을 함께 기록한다. `--top-only`로 상단 첫 플링만 반복할 수 있다. [에뮬레이터 검사](sample/nelyx-demo-app/eng/check-android-scroll.mjs)

```powershell
node sample/nelyx-demo-app/eng/check-android-scroll.mjs
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --cpu
node sample/nelyx-demo-app/eng/check-android-scroll.mjs --controls
```

`--controls`는 두 범위 손잡이, 터치 취소 후 새 드래그, Android IME, 로컬 이미지와 WebGL 컨텍스트 복구를 확인한다. 최신 APK의 이 검사 결과는 §7에 기록했다.

자동 테스트마다 20분 제한을 적용하고 대부분 30회 이내로 검증한다. 임시 입력 도구·녹화·브라우저 연결은 종료 시 정리하고 결과를 이 문서에 반영한다. [저장소 검증 지침](.github/copilot-instructions.md)

Core 회귀 검사는 앞선 섹션의 높이가 줄어드는 프레임에서 보정된 가시 범위에 필요한 카드만 생성하는지 확인한다. 폭·글자 크기 변경, 키 이동·삭제와 역방향 스크롤에도 기준 카드와 State를 유지하는지 검사한다. 필수 프레임 요청과 소진된 유휴 예산은 선택 생산보다 우선한다. [섹션 준비 검사](Nelyx/eng/check-section-preparation.mjs)

## 5. Pixel 5 재검증

Pixel 5 x86_64, Android API 33의 60Hz 화면과 WebView `109.0.5414.123`에서 호스트 OpenGL로 실행했다. 1080×2340 기기에서 DPR은 2.75이며 Demo의 래스터 배율 상한은 2다. `run:android` 설치 결과와 패키지 매니페스트, 실행 중인 WebView의 `build.json`에서 개선 PWA 빌드 ID `592b45bffd81a820dea9b2cdca91b16be49697770df05856c18be4a60c21d5ad`를 확인했다. APK 해시를 대조했고 설치된 기본 ABI는 x86_64다.

기준 APK는 §2의 빌드다. 각 APK를 새 앱 프로세스로 3회 시작했다. 같은 세로 좌표와 시간으로 Android에 터치 이벤트를 주입했다. 스크롤 영역의 x는 70px로 고정하고 1,180ms 느린 스와이프, 205ms 플링, 하나의 터치에서 네 번의 방향 구간을 사용했다. 아래 비교에서는 두 APK에 같은 WebGL 계측만 적용했다. p95·p99는 실행별 백분위의 중앙값이고 최장은 전체 실행의 최댓값이다. 상단 첫 플링의 개선 APK 두 실행은 유효한 `DisplayPresentTime` 간격을 얻지 못해 표시 통계에서 제외했다.

| 동작 | Android 표시 p95 (ms), 이전 → 개선 | 표시 p99 (ms), 이전 → 개선 | 최장 표시 간격 (ms), 이전 → 개선 |
| --- | ---: | ---: | ---: |
| 상단 첫 플링 | 18.34 → 18.49 (개선 1회) | 18.34 → 18.49 | 33.17 → 18.49 |
| 중단 방향 전환 | 27.36 → 33.08 | 31.23 → 35.54 | 33.32 → 50.43 |
| 중하단 첫 플링 | 50.04 → 53.18 | 115.45 → 53.18 | 117.23 → 117.66 |
| 하단 방향 전환 | 20.35 → 28.46 | 33.42 → 30.31 | 36.63 → 83.61 |
| 중하단 재방문 플링 | 19.24 → 32.56 | 19.83 → 36.83 | 33.32 → 50.14 |
| 하단 재방문 방향 전환 | 19.44 → 32.46 | 19.68 → 33.38 | 32.23 → 39.10 |

상단 첫 플링에서 WebView 제출 간격 p95의 중앙값은 136.5ms에서 97.3ms로 줄었고, 최장 간격은 144.1ms에서 176.5ms로 늘었다. 상단 외 다섯 동작의 표시 p95는 기준보다 길었다. 개선 APK에서 안정적인 60fps와 반복 끊김 해소는 확인되지 않았다. 앱 제출 간격, Android 표시 시각과 실제 화면 스캔아웃은 별도의 관측값이다.

- 별도의 `FrameDiagnostics` 실행에서 상단 첫 플링은 3회 모두 필요한 새 카드 두 개 중 하나를 유휴 시간에 생산해 게시했다. 레이아웃 최장은 24.8–27.6ms, `flush()`는 81.0–118.9ms, fence 등록은 0.2–0.9ms였다. 첫 방문에 새 셰이더 8개를 컴파일했다. 긴 제출은 fence 등록 전에 발생했다.
- 중하단 첫 플링에서는 새 카드 1–5개가 필수 경로에서 생성됐고, 레이아웃 최장은 실행별 17.9–65.4ms였다. 첫 방문의 새 Picture는 9–51개, 재방문은 2–8개였다. 재방문 3회의 레이아웃 최장은 6.4–8.4ms였으며 전체 표시 간격에는 긴 구간이 남았다.
- 범위 슬라이더의 시작 손잡이는 25에서 32로, 끝 손잡이는 75에서 68.5로 바뀌었다. 각 드래그에서 반대쪽 값이 유지됐다. 터치 취소 뒤 시작 손잡이는 새 드래그에 반응했다. 느린 이동과 빠른 방향 전환을 섞은 별도 녹화에서 WebView 입력 표시와 시작 손잡이의 위치 차이는 이동 표본 56개 기준 p95 13.30 CSS px, 최대 19.09 CSS px였다.
- Android 키보드가 표시된 상태에서 **Write something**에 `804`를 입력하고 키보드를 닫았다. 로컬 이미지 화면에서 WebGL 컨텍스트를 강제로 손실시킨 뒤 복구했다. 전후 캡처의 동일 영역에서 오렌지색 계열 픽셀 154,391개를 각각 확인했고 복구 뒤 첫 카드로 돌아왔다. Chromium의 DPR 1·2 클리핑 픽셀, Core 섹션 준비·기준점 검사, 범위 슬라이더 회귀 및 Demo 타입 검사도 통과했다.

성능 인수는 `PARTIAL`이다. 상단 첫 플링에 남은 CanvasKit `flush()`의 동기 작업과 중하단에서 여러 새 카드가 동시에 필요한 레이아웃이 다음 조사 지점이다. 현재 연결된 Android 대상은 에뮬레이터 한 대다. Galaxy 비교와 실제 손가락 조작은 미검증 상태다.

## 6. CanvasKit 셰이더 변경 검증

Pixel 5 API 33, WebView `109.0.5414.123`, 호스트 OpenGL 60Hz에서 §5의 APK와 CanvasKit `m153-nelyx-paragraph.8`을 포함한 APK를 비교했다. 새 APK의 PWA 빌드 ID는 `d8553aa28fa5c34c7f1b2c9b91f81a6b726e5f3d0c61f693ae339af34e8f9da6`이다. 설치된 APK는 x86_64이며 파일 해시와 WebView가 응답한 빌드 ID를 대조했다.

CPU 계측을 켠 상단 첫 플링은 APK별 3회씩 실행했다. 양쪽 모두 새 셰이더 8개를 컴파일하고 링크 상태를 4회 확인했다. 개별 `COMPILE_STATUS` 조회는 매회 8회에서 0회로 줄었다. 각 실행의 가장 긴 `flush()`는 기존 229.4–374.1ms, 변경 후 234.8–389.0ms였다. 상단 첫 플링의 긴 제출이 남아 있으며 에뮬레이터에서 `flush()` 감소는 재현되지 않았다.

새 APK의 하단 첫 방향 전환에서 실행별로 카드 1–2개가 필수 레이아웃에서 생성됐고, 각 실행의 가장 긴 레이아웃은 77.3–288.8ms였다. 하단 재방문에서는 새 카드 생성이 0회였고 fence 확인 호출 p95는 0.1–0.2ms였다. 재방문 방향 전환에서 입력이 JavaScript에서 처리되기까지 가장 길게 기다린 시간은 156.8ms였다.

WebGL·CPU 계측을 끈 실행도 APK별 3회 진행했다. 같은 786×1602 래스터 크기에서 Android 터치 경로를 재생하고, SurfaceFlinger의 앱 레이어 표시 시각을 사용했다. p95와 p99는 실행별 백분위의 중앙값이며 실행당 유효 간격이 3–16개여서 이 표에서 두 값은 같다. 하단 재방문 방향 전환에서 새 APK 한 실행의 표시 간격을 얻지 못했다. 상단 플링은 205ms로 설정했으나 실제 주입 시간은 기존 206–211ms, 새 APK 220–239ms였다.

| 동작 | 표시 p95·p99 (ms), 기존 → 새 APK | 최장 표시 간격 (ms), 기존 → 새 APK |
| --- | ---: | ---: |
| 상단 첫 플링 | 292.28 → 366.18 | 314.51 → 392.96 |
| 중단 방향 전환 | 93.79 → 61.89 | 192.37 → 205.46 |
| 중하단 첫 플링 | 70.69 → 129.94 | 78.81 → 156.34 |
| 하단 방향 전환 | 48.61 → 101.99 | 68.89 → 117.47 |
| 중하단 재방문 플링 | 95.20 → 66.84 | 122.81 → 96.20 |
| 하단 재방문 방향 전환 | 56.35 → 48.91 (새 APK 2회) | 88.75 → 51.29 |

첫 플링과 재방문 모두 16.7ms 기준을 초과했으며 33.3ms 이상 간격이 반복됐다. 성능 인수는 `PARTIAL`이다.

소스에서 빌드한 WebAssembly를 Chromium에서 실행했다. 정상 셰이더는 컴파일 요청 두 번 뒤 링크됐고 지정한 픽셀을 그렸다. 잘못된 셰이더는 링크 검증에서 거부됐으며 실패한 프로그램을 사용하지 않았다. Core 섹션 준비와 기준점, Material 범위 슬라이더, 브라우저 DPR 1·2 클리핑 픽셀, Demo 타입 검사가 통과했다. [셰이더 검증](Nelyx/skia/eng/source-build/check-webgl-shader-validation.mjs)

## 7. 중간 마무리

사용자 요청으로 작업을 일시정지했다. 섹션 레이아웃과 유휴 준비, WebGL Picture·Surface 재사용, CanvasKit `.8` 셰이더 변경, 에뮬레이터 재현 도구를 작업 트리에 보존했다. 에뮬레이터에는 §6의 x86_64 APK가 설치돼 있다.

- **60fps 인수 미충족.** §6에서 첫 플링과 재방문 모두 표시 간격 기준을 초과했다. 스크롤 비교 뒤 같은 WebView에서 CSS 사각형만 움직이는 대조 실행 3회에서도 `requestAnimationFrame` 간격 p95가 모두 116.67ms였고 SurfaceFlinger p95는 110.56–112.52ms였다. 이 실행들은 측정 환경 자체에도 긴 표시 간격이 있었음을 보여 준다. 스크롤 비교와 시점이 달라 갤러리 지연 중 환경의 비중은 확인되지 않았다.
- **최신 APK의 입력 인수는 부분 검증.** 한 실행은 양쪽 범위 손잡이와 취소 후 재드래그, 키보드 표시, `804` 입력과 키보드 닫기 검사를 통과했다. 최종 재실행에서는 시작 손잡이의 느린 드래그 값이 검사 범위 31–33을 벗어났다. 최신 APK에서 추종의 반복 통과는 확인되지 않았다.
- **최신 APK의 이미지 복구는 미검증.** 처음 캡처한 접근성 영역에는 이미지 높이 중 약 22 CSS px만 들어왔다. 검사에서 넓은 가시 영역을 확보하고 Android 화면을 캡처하도록 수정했으며, 최종 실행은 이미지 단계에 도달하기 전에 범위 슬라이더 확인에서 종료됐다. §5의 이미지 픽셀과 컨텍스트 복구 결과는 이전 APK의 기록이다.
- **Galaxy 인수는 미검증.** 이번 작업 당시 연결된 Android 대상은 에뮬레이터 한 대였다. Galaxy의 동일 조건 비교와 실제 손가락 조작은 남아 있다.
