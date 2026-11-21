# Nelyx Demo Android 빠른 스크롤 끊김 개선

**2026-11-21 · `tauri-backend` · 구조 개선 일부 적용 · 60fps 검증 PARTIAL**

`sample/nelyx-demo-app`의 **All components**에서 빠르게 밀거나 손을 떼지 않고 방향을 바꿀 때 카드가 한 번에 이동하듯 보인다. 특히 앱을 열고 아직 만들지 않은 카드를 처음 지날 때 긴 프레임이 남는다. 빠른 스크롤을 고치는 과정에서 범위 슬라이더 손잡이가 뒤늦게 따라붙는 증상도 보고됐다. 목표는 첫 진입과 반복 스크롤 모두에서 안정적인 60fps를 달성하고, 범위 슬라이더와 입력창의 반응을 유지하는 것이다. Android는 [W3의 Vite PWA와 Tauri 경로](work3.md)를 사용한다.

## 1. 현재 구조와 남은 병목

| 경로 | 현재 동작과 확인할 지점 |
| --- | --- |
| 섹션 생성과 유지 | 가변 높이 목록은 이전에 생성한 카드를 캐시 범위에서 유지한다. 화면 밖에서 처음 필요한 카드는 브라우저의 `requestIdleCallback` 예산 안에서 준비한다. 화면에 들어오면 준비한 트리를 한 번 이어받고, 실제 크기와 스크롤 기준점을 확정한다. 유휴 예산이 없거나 준비가 끝나기 전에 화면이 도달하면 필수 레이아웃이 그 작업을 맡는다. Demo의 이미지와 입력창 구역은 호스트 연결이 필요하므로 현재 일반 생성 경로를 쓴다. [섹션 레이아웃](Nelyx/src/framework/rendering/sliver-section-list.ts) · [분할 준비와 인계](Nelyx/src/framework/widgets/subtree-preparation.ts) · [Demo 적용 범위](sample/nelyx-demo-app/src/components.ts) |
| 입력 좌표 | 웹의 기본 입력창은 포커스된 경우에만 IME용 커서·선택 좌표를 계산한다. 스크롤 중에도 브라우저에 역할·값·화면상 위치를 전달하고, 포커스 시 최신 입력 좌표를 전달한다. [프레임 경로](Nelyx/src/framework/widgets/root.ts) · [브라우저 입력과 접근성](Nelyx/sdk/src/backends/browser/interaction.ts) |
| WebGL 제출 | `WebSkiaLibrary.submit()`은 장면을 재생하고 `surface.flush()`를 호출한 뒤 GPU fence를 등록한다. 따라서 뒤에서 fence를 확인하더라도, 처음 사용하는 셰이더의 컴파일 상태 조회나 텍스처 업로드가 제출 호출을 길게 만들 수 있다. 에뮬레이터의 긴 프레임에서 셰이더 상태 조회와 긴 제출 시간이 함께 관측됐다. [CanvasKit 제출 경로](Nelyx/skia/packages/web/src/library.ts) |

Doroti의 `RenderSectionList`에서 가시 범위와 보존 범위를 구분하는 구조를 가져왔다. 남은 렌더링 작업은 Doroti의 `SkiaSceneRenderer`가 래스터 캐시 준비에 시간·픽셀 예산을 두는 방식을 참고한다. Nelyx에서는 기존 렌더러와 GPU 리소스 소유권을 기준으로 적용 가능 범위를 판단한다.

## 2. 2026-11-21 측정 결과

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

## 3. 이어서 고칠 순서

### W4-01 · 처음 보는 카드에서 발생하는 필수 레이아웃 비용 줄이기

- [ ] 코드에서 `createChild`부터 섹션 실측과 오프셋 보정까지 추적한다. 빠른 이동이 다음 준비 대상을 건너뛰는 경우, 준비가 끝나기 전에 필수 경로가 이어받는 경우, 이미지·편집기처럼 일반 생성 경로를 쓰는 경우 각각의 비용을 찾는다. [Sliver 요소](Nelyx/src/framework/widgets/sliver.ts) · [섹션 높이 인덱스](Nelyx/src/framework/rendering/section-extent-index.ts)
- [ ] 필수 경로에서 반복되는 생성·텍스트 측정·레이아웃을 우선 줄인다. 재사용 범위는 콘텐츠와 실제 제약이 같은 결과로 제한한다. 방향 전환, 폭·글자 크기 변경, 목록의 키 이동·삭제에서도 현재 카드와 오프셋을 맞춘다. 유휴 준비가 없어도 실제 가시 범위를 채우고 위젯 생성·생명주기·콜백 순서와 Focus·GlobalKey 소유권을 보존한다. [분할 준비의 기존 설계](history/26/11/17/work4-summary.md)
- [ ] 가시 범위와 레이아웃 비용을 같은 동작에서 비교한다. 카드 최초 생성·준비 후 게시·기존 카드 재사용 횟수와 레이아웃 시간을 기록해 첫 플링의 긴 프레임이 줄었는지 확인한다.

### W4-02 · 새 콘텐츠의 WebGL 제출 비용 줄이기

- [ ] 코드에서 Picture 기록, 장면 재생, CanvasKit `flush()`, WebGL 셰이더 상태 조회·텍스처 업로드와 fence 대기의 순서를 확인한다. 비용이 겹치는 지점을 찾고 제거할 수 있는 동기 작업을 고른다. 변경 후 같은 콘텐츠의 첫 방문과 재방문을 실제 WebView에서 계측해 셰이더 신규 사용과 장면 재기록의 비용을 확인한다. [Web Skia](Nelyx/skia/packages/web/src/library.ts) · [프레임 계측](Nelyx/src/ui/frame-diagnostics.ts)
- [ ] 긴 프레임과 연결된 반복 기록이나 리소스 준비를 줄인다. 이미 준비 가능한 작업을 앞당길 경우 호스트 예산과 같은 GPU 컨텍스트에서의 재사용을 확인하고, 입력이나 필수 프레임 요청이 들어오면 양보한다. 클리핑·텍스트·픽셀 품질과 렌더러의 대기열 제한, 컨텍스트 손실 후 복구 및 리소스 정리를 검증한다. [렌더러 연결과 제출](Nelyx/src/hosting/runtime.ts)
- [ ] 두 변경을 함께 빌드해 첫 플링과 재방문을 비교한다. 레이아웃이 짧아져도 `submit`이나 입력 대기가 늘어 표시 간격이 길어지는지 확인한다.

### W4-03 · Android에서 스크롤과 입력 인수

- [ ] Pixel 5에서 전체 왕복과 회귀를 먼저 확인한다. 새 앱 실행 직후 상단과 중하단 플링, 손을 뗀 뒤 관성 이동, 한 번의 터치로 중단·하단을 빠르게 방향 전환하는 동작, 같은 위치 재방문을 실행한다. 실제 터치 입력과 포커스·키보드·화면 복귀를 검사한다.
- [ ] Galaxy를 사용할 수 있을 때 동일 기기·주사율·화면 크기·WebView에서 이전 빌드와 개선 빌드를 비교한다. 동작 경로와 입력 시간을 고정하고 각 경우를 같은 횟수로 반복한다. 실제 손가락으로도 끊김과 슬라이더 추종을 확인한다.
- [ ] `FrameDiagnostics`의 입력 대기·레이아웃·페인트·접근성·제출과 Android 표시 간격을 각각 읽는다. 활성 이동 구간의 60fps 판정 기준은 표시 간격 p95 16.7ms 이내와 33.3ms 이상의 반복 끊김 해소다. p99와 최장 간격도 함께 남긴다. Galaxy 120Hz의 VSync 간격은 약 8.33ms다. 표시 시각을 얻지 못한 실행은 제출 시간과 기능 확인까지만 기록한다.
- [ ] 범위 슬라이더를 느리게 드래그하거나 빠르게 방향을 바꿀 때 시작·끝 손잡이와 값이 입력에 맞춰 움직이는지 확인한다. 놓는 순간의 최종 값, 터치 취소, 포커스 복귀를 확인하고 영상으로 손잡이와 입력 위치 차이를 비교한다. 이미지, 클리핑, 접근성 및 IME 입력도 회귀를 확인한다.

## 4. 재현과 검증 경로

검증 순서는 코드·호출 경로 분석, 가설과 변경 적용, 같은 조건의 실행 비교 순이다. Windows PowerShell에서 Android SDK와 JDK를 먼저 설정한다. 준비와 기기별 명령은 [Demo Android 실행 가이드](sample/nelyx-demo-app/README.ko.md)를 따른다. Core·SDK·Skia를 수정한 경우 갱신된 `dist`를 `npm.cmd run prepare:sample -- web sample/nelyx-demo-app`으로 러너에 공급한 뒤 Android 빌드를 만든다.

```powershell
adb devices -l
npm.cmd run build:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
```

Galaxy를 다시 확인할 때는 `--architecture arm64`로 빌드하고 `--device`에는 `adb devices -l`에 표시된 Galaxy 시리얼을 사용한다. APK 매니페스트와 실행 중인 WebView의 `build.json`을 대조해 실제로 같은 PWA를 실행하는지 확인한다.

전체 왕복은 화면 상단의 **Filled** 버튼부터 하단의 **Local and network images** 카드까지 이동한 뒤 돌아온다. 앞선 비교에서는 약 1,180ms 느린 스와이프와 약 205ms 빠른 스와이프를 사용했다. 플링과 방향 전환은 터치 시점과 이동 경로를 함께 고정하고, 첫 진입과 재방문을 구분한다.

자동 테스트마다 20분 제한을 적용하고 대부분 30회 이내로 검증한다. 임시 입력 도구·녹화·브라우저 연결은 종료 시 정리하고 결과를 이 문서에 반영한다. 현재 첫 재개 지점은 W4-01이며, Galaxy 60fps 인수 상태는 `PARTIAL`이다. [저장소 검증 지침](.github/copilot-instructions.md)
