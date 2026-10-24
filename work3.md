> 2026-10-10: 제품 구조 정리와 W1~W3 검증 구성 제거는 [work4.md](work4.md)로 이관했습니다. 아래는 과거 W3 계획이며, 삭제된 docs/검증 경로의 링크는 역사적 참조입니다. 현재 사용법은 [README.md](README.md)를 따릅니다. W3 전체 기능 상태는 PARTIAL이며 W4로 완료 처리하지 않습니다.

# work3 — Nelyx 데스크톱을 React Native Windows·macOS·Linux로 전환

**중간 마무리·용량 정리 (2026-10-10): 사용자 요청으로 작업을 일시 중지했다.** 재설치 가능한 임시 dependency와 native 빌드 캐시 352개를 정리했다. 소스·복원 입력·최종 증거를 보존했으며 전체 상태는 PARTIAL이다. [중간 인계와 복원 절차](Nelyx/docs/work3-interim-pause.md), [pause checkpoint](Nelyx/docs/validation/work3/pause-checkpoint-2026-10-10-cleanup.json)를 먼저 확인한다.

작성일·조사일: **2026-10-09 KST**. 조사한 checkout: `3435dc10230cb3374c432f583db53930ce2f89c3`.

**이 문서가 새 작업계획이다. `work2.md`의 Deno desktop 계획은 폐기한다.** Windows는 React Native Windows, macOS는 React Native macOS, Linux는 사용자가 지정한 [lucid-softworks/react-native-linux](https://github.com/lucid-softworks/react-native-linux)를 기반으로 다시 구성한다. 기존 W2 소스·결과·실패 기록은 재사용 판단과 회귀의 근거로 보존하며, W2의 다음 Deno 관문을 이어서 실행하지 않는다.

**사용자 범위 조정 (2026-10-09): Apple 플랫폼(macOS/iOS)은 코드 구성까지 진행한다.** 연결 가능한 Mac이 없으며, Xcode/Pods native build·simulator/device 실행·Metal 표시·서명 검증은 이번 완료 조건에서 제외한다. Apple runner/provider/binding/packaging 코드는 구성하고 가능한 source·types·Metro·pack 검사를 수행한다. Apple native 상태는 `SKIPPED/notVerified`로 보존하며, Mac 부재를 공통 구현이나 Apple 코드 구성의 대기 조건으로 삼지 않는다. 아래 native 검증 요구는 Apple에 대해서 후속 검증 목록으로 읽는다.

**추가 사용자 범위 조정: Linux GPU 검증은 생략한다.** Linux native Vulkan/Graphite 구현·빌드, RN host/component/services 연결은 계속 진행한다. 실제 GPU 표시·DMA-BUF hardware import·X11/Wayland GPU acceptance는 이번 완료 조건에서 제외하고 `SKIPPED/notVerified`로 기록한다. Vulkan ICD 없는 Docker의 성공한 native component/거부 경로 검사를 GPU 성공으로 올리지 않는다. 이 범위에서 surface 전략을 확정하고 공통 SDK/runner migration을 진행할 수 있다.

현재 상태: **W3-00 완료 / 여섯 기본 runner·SDK·tooling 이관 진행 / 전체 PARTIAL**. v60에서 고정 RNW Core의 pre-unload ACK, process lease/sticky factory 거부, strong-ref0 detached Finalize와 새 Composition session을 private source/consumer에 연결했다. 실제 표준 Metro reload5/Ready6/CLOSED6, 매회 Count2→0 초기화·편집·native drain 순서·정상 종료가 통과했다. 별도 실제 Core/Hermes에서는 마지막 host 참조 해제·actor 파괴, ACK 전 VM 보존·factory 거부, 정상 owner 소멸·lease 재사용, 실패/20초 deadline/늦은 ACK와 public ReloadInstance의 queued factory·재시도·다른 host 거부 사례5가 통과했다. 수정 Core의 Release groups515/입력2131과 원본·patch·실패 도구·raw compiler·완전한 native package를 보존했다. **기본 제품·다섯 archives·supplier는 v58 그대로**이며 v59 stock reload 실패는 이전 supplier 근거로 유지한다. 최신 proof는 제품 공급자 승격이나 전체 SDK/GPU fault teardown 완료가 아니다. Apple 코드 전용과 Linux GPU 생략은 유지한다. [최신 Windows Core drain/reload v60](Nelyx/docs/work3-windows-drain.md), [stock 실패/source build v59](Nelyx/docs/work3-windows-reload.md), [Windows development/maps v58](Nelyx/docs/work3-windows-development.md), [Linux source maps v57](Nelyx/docs/work3-linux-source-maps.md), [Android owner/reload v54](Nelyx/docs/work3-android-reload.md).

실행 checkpoint: [resume-checkpoint-v60.json](Nelyx/docs/validation/work3/resume-checkpoint-v60.json), [scoped/failed receipts index v60](Nelyx/docs/validation/work3/index-v60.json). 사용자 요청으로 중간 마무리하며 목표 paused·전체 PARTIAL이다. 다음은 검증된 Core patch/COM·app headers와 protocol/hash supplier를 기본 prepare/build/verify/run/template/package 경로에 반영하는 관문이다. 이번 단계는 검증 도구·문서/checkpoint와 별도 source producer/consumer만 변경했다. 기본 Skia compiled146 입력은 그대로이며 root broad check는 v58 계약155/imports541이 최신이다. 실제 전체 SDK/GPU 초기화 실패·close 중 drain·fatal/forced parent loss·reconnect/SDK·asset module, Linux 초기 HMR·HTTP races, Android cold-start/전체 forced-fatal barrier·aggregate I/O budget, native loss/장기 budget·자동 공급·W3 CI/release/notices-SBOM·physical qualification도 남는다. 이전 Temp runtime303 paths 누락과 초기 native fixture HRESULT 오류의 정확한 원인은 미확정이다. 다른 target native는 재실행하지 않았고 Android 마지막 근거는 v54 Debug, v52 Release는 historical이다.

## 1. 이번에 확정하는 방향

1. 데스크톱 앱의 JS runtime·최상위 창·native View·개발 reload·배포 실행은 각 RN 플랫폼이 담당한다. Nelyx는 그 위에서 공통 앱, 서비스 구성, Skia surface, 프레임·자원 수명을 제공한다.
2. Deno/V8 desktop, Laufey/winit raw window, Deno FFI 및 Metro→Deno factory/bootstrap/compile 경로는 제품에서 제거한다. React Native 기반 runner를 Deno 안에서 다시 실행하는 구조를 만들지 않는다.
3. `@nelyx/core`와 `@nelyx/sdk`의 분리는 유지한다. 공통 앱 진입점은 `src/index.ts`의 실제 `main()`이며, 플랫폼 runner는 루트의 `<platform>/runner/`에 둔다. Widget/Element framework 신설은 이번 전환의 범위에 넣지 않는다.
4. SDK의 RN 공통 서비스를 `backends/react-native/`로 모으고 Android/iOS/Windows/macOS/Linux의 실제 차이를 platform adapter로 구성한다. Web은 React Native Web + React DOM + CanvasKit 경로를 유지한다.
5. barrel/re-export 집합을 만들지 않는다. core·SDK·Skia·tooling·template·생성 bootstrap 모두 선언·구현 파일의 public subpath를 직접 import한다. `.ts` source import와 `.js` ESM/선언 출력 정책도 유지한다.
6. renderer 변경 요청은 없으므로 **Windows/Linux Graphite/native Vulkan, Android Graphite/Dawn/Vulkan, Apple Graphite/Dawn/Metal, Web Ganesh/CanvasKit/WebGL2**를 목표로 유지한다. RN host가 이 renderer를 실제로 수용하는지는 별도 선행 관문이다. 실패를 숨기는 CPU/Ganesh/OpenGL/Dawn/D3D12 자동 전환은 없다.
7. 고정 prebuilt Skia/Dawn와 대응 헤더를 우선 소비한다. 자체 core·JSI·RN component·OS 연결부는 빌드한다. RN Linux가 소스로만 제공하는 native runtime/Hermes의 빌드는 별도 공급 책임으로 기록한다. 전 target 동일 Skia revision이나 전체 Skia/Dawn source build를 기본 완료 조건으로 다시 요구하지 않는다.
8. Nelyx 작성 코드는 BSD-3-Clause를 유지한다. RN 플랫폼, Hermes, RN Skia 및 외부 바이너리의 원래 license·notice·source provenance는 각각 보존한다.

## 2. 현재 저장소에서 확인한 출발점

조사 시작 시 worktree는 clean이었다. `.github/copilot-instructions.md`와 추가 저장소 `AGENTS.md`는 없었다. 과거 상태는 [W2 중간 인계](Nelyx/docs/validation/work2/interim-2026-10-09-linux-desktop.md)와 [paused checkpoint](Nelyx/docs/validation/work2/pause-checkpoint-2026-10-09-linux-desktop.json), 실제 구성은 아래 source를 기준으로 확인했다.

| 영역 | 현재 source·상태 | W3에서의 처리 |
| --- | --- | --- |
| 공통 core | [package](Nelyx/package.json) `@nelyx/core` 0.2.0. `foundation/ui/hosting`의 직접 exports, AppSession·ViewRuntime·PaintFrame·resource lease가 있다. | 유지하고 변경된 host identity만 필요한 범위에서 개정한다. |
| SDK | [package](Nelyx/sdk/package.json) `@nelyx/sdk` 0.4.0. RN/Deno/Web의 optional peers와 여섯 target descriptor가 있다. | Deno peers/exports를 제거하고 다섯 native RN target + Web의 composition을 제공한다. |
| 플랫폼 계약 | [platform.ts](Nelyx/src/hosting/platform.ts)의 runtime은 `browser/hermes/deno`, host는 `react-dom/fabric/sdk-native/deno-raw`다. | RN 플랫폼 종류와 engine·host·GPU identity를 별도로 표현한다. Deno 값은 새 활성 계약에서 제거한다. |
| Windows 앱 | [application.ts](Nelyx/sdk/src/platforms/windows/application.ts)가 `Deno.build`, `backends/deno`, raw HWND 및 host DLL을 사용한다. | RNW AppRegistry 등록·Fabric surface·RN host lifecycle로 교체한다. 같은 파일 이름을 유지하더라도 breaking API 변경이다. |
| macOS/Linux/iOS 앱 | [macOS](Nelyx/sdk/src/platforms/macos/application.ts)·[iOS](Nelyx/sdk/src/platforms/ios/application.ts) provider는 아직 unsupported다. [Linux](Nelyx/sdk/src/platforms/linux/application.ts)는 native host gate를 요구하는 x86_64 코드 구현으로 전환했으며 hardware qualification은 notVerified다. | RN host/provider 수명과 runner를 완성한다. Apple source나 Linux `.so`만으로 앱 구현 완료를 선언하지 않는다. |
| Android | [application](Nelyx/sdk/src/platforms/android/application.ts), [surface](Nelyx/sdk/src/platforms/android/surface.tsx), controls/assets/interaction이 RN 0.83.1에 연결된다. | 재사용할 RN 서비스를 추출하되 Android GPU 정책·event count·emulator 분리는 보존한다. |
| RN Skia | [package](Nelyx/skia/packages/rn/package.json) `@nelyx/skia-rn` 0.1.0. Android Graphite artifact 154.1.0, JSI patch, Apple source/podspec가 있다. Windows/Linux native project는 없다. | 공통 JSI와 OS surface port를 구분한다. Apple 패키징·runtime도 새로 검증한다. |
| RN renderer의 실제 결합 | [RNSkWindowSurface.h](Nelyx/skia/packages/rn/cpp/rnskia/RNSkWindowSurface.h)와 [RNDawnContext.h](Nelyx/skia/packages/rn/cpp/rnskia/RNDawnContext.h)는 Dawn/WebGPU에 연결돼 있다. | Windows/Linux native Vulkan을 이 API에 바로 끼워 넣을 수 있다고 가정하지 않는다. context/surface 연결부를 분리·포팅한다. |
| 공통 native | [native/core](Nelyx/skia/native/core/core.cpp), [rendering](Nelyx/skia/native/rendering/renderer.cpp), Windows/Linux font services와 [Vulkan device](Nelyx/skia/native/platforms/vulkan/device.cpp)가 있다. | scene/text/asset/retirement 알고리즘을 재사용한다. C ABI 핸들 registry와 Deno window owner를 RN component 수명으로 그대로 가져오지 않는다. |
| W2 실행 근거 | Windows D2 HWND/RTX 4060, Android x86_64 lavapipe emulator, Web Chrome/ANGLE 및 Linux Deno/Xlib의 제한된 결과가 기록돼 있다. Linux provider는 unsupported다. | historical evidence로 보존한다. RNW/RNM/RNL의 실제 창·component·GPU 실행은 전부 새 관문이다. |
| 도구 | [root scripts](package.json), `@nelyx/metro`, `@nelyx/cli`, template generator와 consumer가 Deno build/runtime/compile에 연결된다. | 단순 폴더 변경과 함께 검사·생성·외부 소비·CI를 전환한다. |
| 소비 앱 | [testbed package](sample/nelyx-testbed-app/package.json)에 Android RN와 Skia Deno/Web가 함께 있다. Windows runner는 Deno 프로그램이다. | 공통 `src`는 유지하고 native RN runner 프로젝트·버전별 설치 경계를 만든다. |
| artifact 상태 | 조사 시 `Nelyx/.cache`, `Nelyx/artifacts/work2/desktop/deno-target`, private `nelyx-native-win32-x64-0.4.1.tgz`는 존재하지 않았다. | 제거된 byte 파일을 live 재검증하거나 private registry에서 재획득할 수 있다고 가정하지 않는다. lock/recipe/source로 재확보 가능한 입력을 먼저 분류한다. |
| CI | [현재 workflow](Nelyx/artifacts/work3/sdk-deno-retirement/legacy-v1/.github/workflows/work2-windows-native-consumer.yml)는 Deno Windows private native package용 수동 실행이다. | W3 RN native build/runtime CI를 따로 만든다. 로컬 W2 recipe 실행을 원격 RN CI PASS로 취급하지 않는다. |

W2 checkpoint에는 `wholePlanComplete=false`가 남아 있다. 한글 composing, physical input/reader, 실제 loss/recovery, scanout, 전체 장기 메모리 예산, signing/clean-machine 공백은 해결되지 않은 기준선이다. provider JSON과 최신 receipt가 어긋나는 부분도 W3 baseline에서 식별하며 과거 receipt를 수정해 맞추지 않는다.

## 3. 공식 자료에서 확인한 제약과 버전 전략

### 3.1 React Native Windows

[New Architecture 문서](https://microsoft.github.io/react-native-windows/docs/new-architecture/)는 Fabric host가 Windows App SDK의 Composition을 사용하며 native prebuilt NuGet 소비를 기본 경로로 설명한다. [Fabric component 문서](https://microsoft.github.io/react-native-windows/docs/native-platform-components/)는 TypeScript spec → Windows codegen → C++ Component View → native visual의 연결을 요구한다. 따라서 기존 raw HWND 앱을 새 RNW host로 표시하는 변경만으로는 전환이 성립하지 않는다.

조사 시 [npm latest metadata](https://registry.npmjs.org/react-native-windows/latest)는 RNW **0.84.0**, RN peer **0.84.1**이었다. [0.84 release](https://github.com/microsoft/react-native-windows/releases/tag/react-native-windows_v0.84.0)는 Visual Studio 2026을 요구한다. 문서의 과거 VS2022/UWP 설정을 새 Fabric 프로젝트의 확정 조건으로 복사하지 않는다. 선택한 RNW release의 template·MSBuild props·NuGet·설치 workload를 함께 pin한다.

### 3.2 React Native macOS

[공식 시작 문서](https://microsoft.github.io/react-native-macos/docs/getting-started)는 RN/RNM minor 정합과 Xcode·Metro runner를 설명한다. 다만 예제는 0.81 계열이고, 조사 시 [최신 release](https://github.com/microsoft/react-native-macos/releases/tag/react-native-macos%400.83.0) 및 [npm metadata](https://registry.npmjs.org/react-native-macos/0.83.0)는 RNM **0.83.0**, RN peer **정확히 0.83.10**이었다. 실제 package 조건을 버전 선택의 우선 근거로 삼는다.

현재 Nelyx fork에는 `TARGET_OS_OSX` 분기·NSView·CAMetalLayer와 macOS podspec 입력이 있다. 이를 RNM Fabric 등록, Hermes/CallInvoker, Graphite/Dawn artifact, dispose patch까지 연결하고 실제 Mac에서 검증해야 한다. Mac Catalyst와 RN macOS를 같은 target으로 취급하지 않는다.

### 3.3 지정된 React Native Linux

조사한 고정 commit은 **`9412cf605c7cc77f920916401926ff9a9873ecd3`**이다. [README](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/README.md)는 GTK4·Hermes·Fabric 기반의 **alpha, production-ready 아님**을 명시한다. Ubuntu 24.04 CI 기준, 단일 최상위 창, 미완성 이벤트 연결 등의 제한을 플랫폼별 완료 조건에 반영한다.

source를 추가 확인한 결과 문서의 지원 표현만으로는 충분하지 않았다.

- [JS package](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/packages/%40lucid-softworks/react-native-linux/package.json)와 CLI는 **0.0.1**, RN peer **`^0.81.6`**이다. 현재 앱의 RN 0.83.1이나 RNM용 0.83.10을 그대로 사용하면 peer 범위를 벗어난다.
- [Hermes CMake](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/vnext/cmake/FetchHermes.cmake)는 RN 0.81 대응 commit `e0fc67142ec0763c6b6153ca2bf96df815539782`를 pin한다. README의 Hermes 버전 설명과 실제 source를 구분하며 header/runtime/compiler를 함께 확인한다.
- [codegen driver](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/scripts/codegen/run.js)에는 TurboModule header emission이 있지만 **Fabric component 생성은 stamp/marker 수준의 stub**이라고 명시돼 있다. autolink command가 있다는 사실로 Nelyx custom surface의 등록·이벤트·명령이 완성됐다고 판정하지 않는다.
- [CLI bundle-linux](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/packages/%40lucid-softworks/cli/src/commands/bundleLinux.ts)는 Metro를 호출한다. 반면 [playground bundle](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/apps/playground/bundle.mjs)은 esbuild와 vendor/shim 구성을 사용한다. playground 성공과 외부 앱의 정식 Metro 실행은 별개다.
- npm public registry에서 `@lucid-softworks/react-native-linux`, CLI, codegen, expo shim 네 이름을 조회했으며 모두 **404**였다. 설치 가능 버전으로 가정하지 않는다. 고정 source에서 패키지를 빌드·pack하고 `workspace:*`를 외부 소비 가능한 dependency로 바꿔 내부 공급한다. 실행 시 registry 상태는 다시 확인한다.
- 조사한 tree에 Skia port는 없었다. GTK component·JSI·Graphite/native Vulkan surface를 Nelyx 쪽에서 구현해야 한다. 첫 지원 범위는 Linux x86_64 단일 창이며, X11과 Wayland를 각각 검증한다.

이는 선택한 Linux 기반을 포기하는 사유가 아니라 **RN Linux 자체 보완을 작업 범위에 포함해야 하는 근거**다. 수정은 별도의 고정 source·patch manifest로 관리하고 Deno로 되돌리는 우회 경로를 만들지 않는다.

### 3.4 RN Skia와 첫 버전 후보

[upstream RN Skia package](https://github.com/Shopify/react-native-skia/blob/main/packages/skia/package.json)에는 Apple/Android native 입력이 있고, [desktop support 논의](https://github.com/Shopify/react-native-skia/issues/2058)는 macOS 지원과 Windows 전용 backend 필요를 구분한다. 현재 tree·Nelyx fork에도 Windows/Linux port가 없다. upstream `main`의 Graphite/v3 설명, npm dist-tag와 Nelyx의 snapshot을 같은 release identity로 혼합하지 않는다.

첫 호환성 조사에는 다음 후보를 사용한다. **아래는 테스트할 조합이며, 합격 전 배포 pin이 아니다.**

| runner 집합 | 첫 후보 | 선택 이유·추가 검증 |
| --- | --- | --- |
| Android/iOS/Windows/macOS | RN **0.83.10**, React **19.2.0**, RNW **0.83.2**, RNM **0.83.0** | [RNW 0.83.2 peer](https://registry.npmjs.org/react-native-windows/0.83.2)는 `^0.83.0`, RNM은 0.83.10을 요구한다. 기존 Android 0.83.1의 업그레이드 회귀와 CLI/Babel/Metro/codegen patch 정합을 검사한다. |
| Linux | RN **0.81.6**, React **19.1.4**, 위 고정 RNL commit·Hermes commit | 처음 조사한 playground React 19.2.3은 npm peer install을 통과하지만 실제 RN renderer의 exact 19.1.4 검사와 충돌했다. 독립 root의 새 후보를 19.1.4로 조정했다. playground 19.2.3/custom reconciler와 정식 RN renderer를 구분하며 JSI ABI·async lowering·native 연결·Metro 실행은 계속 검증한다. |
| Windows 최신 후보 | RNW **0.84.0** + RN **0.84.1** + React **19.2.3** | 호환성 비교 후보다. RNM 0.83 peer와 불일치하므로 전체 공통 버전을 무조건 latest로 바꾸지 않는다. 선택 시 독립 cohort와 새 lock이 필요하다. |

Linux 때문에 전체 Android/Apple/Windows를 RN 0.81로 내리지 않는다. 우선 runner별 package/lock/install/Metro dependency root를 분리한다. 같은 cohort도 플랫폼의 native project·설정은 각 runner가 소유한다. 단일 버전 통합은 RNL 업그레이드 또는 RNM/RNW 호환을 실제로 입증한 뒤 후속 선택으로 남긴다.

`--force`, `--legacy-peer-deps`, root override로 충돌을 감추지 않는다. SDK/Skia peer는 exact RN 0.81.6/0.83.1/0.83.10·React 19.1.4/19.2.0 install candidate로 개정했다. 실제 지원은 provider matrix의 admission으로 구분한다. shared source를 Metro가 탐색할 때 root의 다른 RN/React를 집어 들지 않는지도 검증한다.

## 4. 목표 책임과 앱 실행 구조

```text
공통 앱 src/index.ts의 main() → @nelyx/core/<실제 모듈>
플랫폼 runner → @nelyx/sdk/platforms/<target>/<실제 모듈>
SDK composition → core + RN 공통 서비스 + 해당 OS adapter
RN desktop host → Hermes/JSI + Fabric component + OS View/window
Nelyx native component → RN JSI adapter + 공통 Nelyx native core + 선택한 Skia/GPU
Web runner → browser services + @nelyx/skia-web/library + CanvasKit/WebGL2
개발/빌드 → 해당 runner의 CLI/Metro/Babel/native project + SDK tooling preset
```

| 책임 | 소유자 |
| --- | --- |
| 앱 상태·scene·asset 선언·startup | 소비 앱의 공통 `src/`와 core 계약 |
| 최상위 창·RN instance·OS event loop·JS engine | RNW/RNM/RNL native host |
| AppSession/ViewRuntime·resource registry·frame admission·SDK 서비스 구성 | Nelyx SDK |
| native component·JSI 설치·context/surface·GPU completion·text/image | Nelyx Skia package와 공통 native 구현 |
| controls/focus/IME/semantics·OS 차이 | SDK platform adapter + 필요한 RN native extension |
| Metro server·Babel config·Gradle/Xcode/MSBuild/CMake 앱 프로젝트 | 플랫폼 runner |
| 재사용 가능한 설정·bootstrap generator·build/run/pack adapter | SDK tooling |

RN의 Yoga/Fabric layout과 Nelyx scene의 layout을 분리한다. native surface에는 실제 view의 logical bounds·pixel ratio·viewport generation을 전달한다. 앱이 native handle을 공통 scene에 저장하거나 renderer가 최상위 창/event loop를 다시 만들지 않는다.

RN AppRegistry를 쓰는 등록 함수와 component 기반 `ApplicationSurface`를 native target의 공통 사용 방식으로 삼는다. 기존 Windows의 `openApplication(library, icu, raw...)`, `poll()` 및 Deno filesystem API를 새 RN API의 호환 wrapper로 남기지 않는다. core의 `main()` 자체는 React component나 barrel로 바꾸지 않는다.

## 5. 목표 저장소·패키지 구조

아래 트리는 W3 구현 목표다. 이미 분리된 core 위치는 유지하고 RN 공통화와 desktop project를 추가한다.

```text
Nelyx/
  package.json                         # @nelyx/core
  src/{foundation,ui,hosting}/          # 플랫폼 구현 의존성 없음
  sdk/
    package.json                       # @nelyx/sdk: 모듈별 exports
    src/runtime/                       # config/provider/bootstrap/assets/lifetime
    src/backends/react-native/          # 등록·services·surface·assets·interaction 계약
    src/backends/browser/              # 기존 Web services/CanvasKit 연결
    src/platforms/{android,ios,windows,macos,linux}/
      application.ts                   # 실제 target 선택/등록 구현
      surface.tsx                      # 실제 target 구성, re-export 없음
      controls.tsx                     # 필요할 때 OS 편집·semantics 구성
    src/platforms/web/                 # browser application/surface
    providers/                         # 새 schema·RN identity·artifact/qualification
    native/platforms/{windows,macos,linux}/
                                       # Skia 외 host 서비스 확장이 필요한 경우만
    tooling/metro/                     # @nelyx/metro: RN target preset + Web
    tooling/cli/                       # @nelyx/cli: target runner를 호출하는 adapter
  skia/
    native/core/                       # RN/JSI/GTK/AppKit/RNW 의존성 없음
    native/rendering/                  # 공통 frame/text/resource/retirement 구현
    native/platforms/{vulkan,windows,linux}/
                                       # 기존 native Vulkan·font 구현의 재사용 부분
    packages/rn/                       # @nelyx/skia-rn
      src/                             # renderer/text/bootstrap/spec 모듈
      cpp/{api,jsi,rnskia,utils}/        # 하나의 canonical RN binding source
      android/                         # 기존 Android native library
      apple/                           # 기존 Apple binding; macOS/iOS 조건 구분
      windows/                         # 새 RNW Fabric library·codegen·MSBuild
      linux/                           # 새 GTK Fabric component·CMake/JSI 등록
      generated/{core,sdk}/             # 명시 생성물, 별도 원본으로 편집하지 않음
    packages/web/                      # @nelyx/skia-web, CanvasKit 단일 경로
    vendor/                            # Skia/Dawn target artifact lock·resolver
    upstream/                          # 기존 snapshot/patch/provenance
    eng/                               # 획득·binding-only build·pack/audit
  upstream/react-native-linux/         # 고정 upstream manifest·license·patch 목록
                                       # source 취득 위치/pack recipe를 함께 명시
  native/packages/                     # 필요할 때 새 RN 전용 target binding artifacts
  tests/{contracts,native,consumers}/
  docs/{architecture,research,validation}/
  eng/                                 # bounded 검증·native test harness
tools/nelyx/                            # 저장소 유지·template sync·source audit
sample/nelyx-testbed-app/
templates/nelyx-app/
  src/{index.ts,app.ts,...}             # 공통 앱, core만 직접 import
  assets/, tests/, nelyx.config.ts
  {android,ios,windows,macos,linux,web}/
    runner/
      main.ts 또는 main.tsx            # target bootstrap의 실제 구현
      package.json, package-lock.json  # target dependency/install root
      metro.config.cjs, babel.config.cjs
      react-native.config.cjs          # 해당 native project 위치 명시
    ...                                # native 프로젝트는 기존 platform root에 배치
                                       # Android app/Gradle, Windows sln/vcxproj,
                                       # Apple xcodeproj/Podfile, Linux CMake/main.cpp
```

runner별 native sourceDir·bundle entry는 각 CLI의 검증된 config로 platform root와 `runner/main`을 가리킨다. init 도구를 기존 디렉터리에서 `--overwrite`로 실행하지 않고, 새 임시 프로젝트에서 template을 비교·통합한다. 플랫폼 폴더가 이중으로 중첩되지 않도록 실제 CLI/codegen/build 결과로 위치를 확정한다.

runner 프로젝트는 root npm workspace의 자동 hoist에 맡기지 않는다. root workspace는 core/SDK/Skia/tooling을 개발하며 runner에는 검증한 tarball 또는 명시적인 local package 입력을 공급한다. Linux는 반드시 별도 dependency tree를 가진다. Metro projectRoot/watchFolders/resolver·native codegen이 같은 cohort의 React/RN을 선택하도록 구성한다. 최종 외부 consumer는 repo `node_modules`와 source watchFolders 없이 검증한다.

공통 native source의 canonical 위치는 한 군데다. package 안에 필요한 source/header는 hash를 기록하며 생성한다. 새로운 `native/adapters/rn`에 기존 `packages/rn/cpp`의 두 번째 수작업 사본을 만드는 구조는 피한다. 옛 C ABI는 내부 C++ 진단에서 실제 필요가 있을 때만 비제품 test target으로 남길 수 있으며 Deno public package/FFI recipe로 계속 배포하지 않는다.

## 6. renderer와 native host 통합에서 먼저 해결할 사항

### 6.1 목표 profile과 검증 환경

아래 새 profile 이름도 계획상의 API다. `host=fabric`과 Hermes만으로 platform 구현을 구별할 수 없으므로 descriptor에는 RN 구현/package version·architecture·native artifact identity를 별도로 기록한다.

| target | runtime·host 구현 | renderer·GPU 목표 | 최초 지원·검증 범위 |
| --- | --- | --- | --- |
| Windows | Hermes / RNW Fabric / Windows App SDK Composition | `rn-graphite-vulkan`, Graphite/native Vulkan | Windows x64 실제 GPU; ARM64는 별도 build/runtime 관문 |
| macOS | Hermes / RNM Fabric / AppKit native View | `rn-graphite-metal`, Graphite/Dawn/Metal | 실제 Apple Silicon Mac; Intel 지원은 별도 artifact/build/runtime 근거 |
| Linux | Hermes / 지정 RNL Fabric / GTK4 | `rn-graphite-vulkan-x11`, `rn-graphite-vulkan-wayland` | Ubuntu 24.04 기준 x86_64, X11/Wayland 각각 실제 GPU |
| Android | Hermes / RN Fabric | 기존 `graphite-vulkan` + 명시 `emulator-vulkan`, Graphite/Dawn/Vulkan | 현재 emulator 회귀 후 ARM64 hardware/default 별도 |
| iOS | Hermes / RN Fabric | `graphite-metal`, Graphite/Dawn/Metal | Xcode build/simulator와 physical ARM64 분리 |
| Web | browser / React DOM + RN Web | 기존 `ganesh-webgl2`, CanvasKit/Ganesh/WebGL2 | 기존 Chrome 회귀, 브라우저 확장은 별도 |

RNW/GTK가 내부적으로 쓰는 compositor renderer와 **Nelyx가 쓰는 GPU backend**도 별도 identity다. GTK 창이 Vulkan으로 합성된다는 이유로 Nelyx Graphite/Vulkan PASS를 주장하지 않는다.

### 6.2 Windows: RNW Composition 안에 surface를 넣기

첫 spike는 Fabric component codegen/등록과 JSI 호출 뒤, **RNW 내부에서 보이는 Graphite surface**까지 진행한다. 기존 HWND/Vulkan 장치·text·completion 알고리즘은 활용할 수 있지만 RNW 최상위 HWND를 빌려 기존 swapchain을 돌리는 경로는 새 통합으로 인정하지 않는다.

native Vulkan 출력의 Composition 호환 texture/visual import, 동기화·adapter identity를 우선 조사한다. RNW가 허용하는 component 내부 native surface/child host가 필요한 경우에는 그 방식의 clipping·transform·z-order·pointer/focus·DPI·overlay를 함께 검증한다. 별도 top-level raw 창으로 surface를 띄우는 시연은 탈락이다.

공개 RNW API로 목표 renderer를 수용할 수 없으면 필요한 최소 RNW extension/patch, 공급 SDK 및 ABI 변경을 ADR에 구체화한다. Dawn/D3D12는 별도 변경 후보로만 기록한다. 기존 사용자 GPU 정책을 조용히 바꾸지 않고 해당 관문을 `FAIL/PARTIAL`로 남긴다. 다른 OS 및 공통 계약 작업은 독립 진행할 수 있다.

### 6.3 Linux: GTK component·JSI·surface port

RNL의 core View 성공 다음에 Nelyx custom component의 props/layout/events/commands와 JSI 설치를 검증한다. Fabric generator가 stub인 부분은 고정 버전의 ComponentDescriptor·등록·이벤트 연결을 직접 구현하거나 제한된 generator patch로 보완한다. 추가 native module이 autolink되는 것과 native View가 mount되는 것을 각각 입증한다.

GTK/GSK와 Nelyx가 같은 최상위 surface에 서로 다른 swapchain을 생성하지 않도록 구성한다. component 소유 surface 또는 GTK가 수용하는 GPU texture import 방식의 가능성·GDK backend·pixel format·modifier/synchronization·release callback을 확인하고 선택한다. CPU readback→GTK bitmap 표시를 hardware profile의 완료 경로로 쓰지 않는다.

X11 handle과 Wayland 객체는 GTK/GDK의 owner thread/lifetime을 따라야 한다. 이전 Deno Xlib/Wayland lease는 새 GTK lease로 승계할 수 없다. WSLg의 CPU Vulkan 거부 결과는 negative control이며 실제 Linux GPU frame·presentation acceptance가 아니다. native Ubuntu와 WSLg/VM을 별도 environment로 보고한다.

### 6.4 macOS: 기존 Apple port를 actual RNM 앱에 연결

NSView/CAMetalLayer, RNM Fabric component 등록, module/CallInvoker, Apple Graphite/Dawn prebuilt·matching headers·podspec를 연결한다. 현재 RN package가 Android artifact만 직접 의존하는 점과 podspec의 iOS/macOS artifact 준비 조건을 함께 정리한다. macOS-only 소비가 불필요한 iOS payload 부재 때문에 실패하지 않도록 target별 공급·autolink를 검증한다.

main thread의 View/layer 수명과 native GPU completion을 분리한다. detach/remount, 창 닫기, backing scale/모니터 변경, minimize/occlusion에서 generation과 자원 lease를 보존한다. Apple source 존재, pod install 성공, Metal offscreen 출력은 각각 전체 RNM 앱 실행의 증거가 아니다.

### 6.5 공통 수명과 ABI

- JSI object·Runtime/CallInvoker는 runtime generation에 귀속한다. GPU/retirement callback이 폐기된 runtime에 진입하지 않도록 closing admission·weak ownership·native completion queue를 둔다.
- JS thread, UI/GTK/AppKit thread, renderer owner thread의 경계를 명시한다. JSI object를 임의 GPU thread로 전달하지 않는다. immutable frame과 native resource lease만 경계를 넘긴다.
- React effect cleanup은 비동기 GPU drain을 기다려주지 않는다. native component owner가 detached 상태에서도 completion을 관리하고, 새 runtime/view의 admission과 unload를 확인된 retirement 뒤에 허용한다.
- Fast Refresh와 full runtime reload/OS 종료를 구분한다. 정상 RN 개발 흐름을 사용하되 full reload 직전 frame admission을 닫고 context drain→JSI 무효화→View/instance release 순서를 보장한다.
- accepted/rejected/unknown, bounded slots, metrics/context/surface generations, text UTF-16 범위, GPU retirement와 present/scanout 구분을 유지한다. native CPU/GPU tracked counters와 OS allocator 관측의 범위도 별도로 기록한다.
- target별 JSI binding·공통 core·text/image modules는 **동일 target의 matching Skia SDK**로 빌드한다. m153 native Vulkan 라이브러리와 m154 RN Dawn 라이브러리를 같은 process에 섞어 C++ 객체를 넘기지 않는다. target 간 revision 차이는 허용하지만 한 process의 Skia/Dawn 중복 identity는 검사한다.
- 기존 Linux `.so`의 GLIBC 2.43 요구를 Ubuntu 24.04 배포 근거로 사용하지 않는다. 새 triplet/min-OS/GTK/Hermes/libstdc++/ICU 및 Vulkan driver 요구를 기준 환경에서 다시 검증한다.

## 7. 제거·이동·재사용 목록

| 현재 항목 | 최종 처리 | 보존·전환 기준 |
| --- | --- | --- |
| `Nelyx/sdk/src/backends/deno/` | active source·exports·build graph에서 제거 | assets/service 알고리즘 중 공통 부분만 RN service로 이식 |
| Windows `raw-window.ts`, Linux `raw-window.ts`, Windows open/poll API | 새 RN 등록/surface API로 교체·옛 export 제거 | 이전 raw profile을 RN profile alias로 자동 변환하지 않음 |
| `Nelyx/sdk/native/desktop/deno-bridge/`, raw host·Laufey runtime 준비 | Deno 전용 Rust/C++ host·prepare·runtime supply를 제거 | renderer/font/input 알고리즘 중 필요한 부분은 각 RN native extension으로 이식 |
| `Nelyx/skia/packages/deno/`, `@nelyx/skia-deno` | workspace·peer·exports·pack·consumer에서 제거 | frame wire 또는 C ABI 중 runtime 중립적인 진단만 C++ test harness로 보존 가능 |
| `Nelyx/native/packages/win32-x64` 0.4.1 | Deno payload package는 폐기·historical metadata 보존 | 새 RN native package를 별도 identity로 작성; 이름/manifest만 바꿔 재사용하지 않음 |
| Metro `deno-config`, Windows factory/bootstrap/runtime/host-services | public exports·serializer·compile 기능 제거 | RN preset, Web build와 일반적인 source-map 검사만 유지·개정 |
| Deno Windows runner 및 `nelyx.windows.bootstrap.ts` | RNW runner와 RN bootstrap으로 교체 | common `src`와 자산 manifest 유지 |
| `deno.json`, `metro.deno.config.cjs`, Deno build/test tasks·types | 제품 및 기본 개발·portable 검사의 Deno 의존성 제거 | 공통 runtime 검사를 Node/tsx 계약 검사로 전환; native FFI fixture는 C++/RN 회귀로 치환 |
| `native/core`, `native/rendering`, Vulkan/font source | 의존성을 분리한 뒤 재사용 | Deno owner/callback registry나 shared top-level swapchain 가정 제거 |
| `packages/rn` JSI·paragraph/admission/retirement patch | 유지·Windows/Linux port 추가 | source identity·canonical generated source audit 갱신 |
| Android services·surface·controls | RN 공통 서비스 추출 + Android 전용 부분 유지 | RN 버전 변경·한국어 IME·software emulator 제한 회귀 |
| Web adapter/CanvasKit lock·runner | 유지·root/CLI/template 변경에 대한 회귀 | browser가 RN native package를 초기화하지 않음 |
| `work2.md`, W2 docs/receipts/source backup | 폐기된 계획·historical evidence로 보존 | 활성 계획·README·doctor·새 manifest는 W3을 가리킴; 과거 receipt/hash 변경 없음 |

제품 제거는 실행 관문과 의존성 분류 뒤 별도 변경으로 수행한다. 중간 단계에서 남은 Deno 코드는 deprecated/격리 상태를 명시하며 새 지원 기본값에 선택되지 않게 한다. 최종 W3에는 제품·template·표준 검사의 Deno dependency가 없어야 한다. cache/artifact 정리는 위 source migration과 구분하고 shared Cargo/toolchain·다른 프로젝트 경로를 정리 대상으로 잡지 않는다.

## 8. 단계별 작업

완료한 단계만 `[x]`로 표시한다. scoped 결과가 있는 미완료 단계는 `[ ]`와 PARTIAL을 유지한다. 각 단계는 **변경 소스, 독립 실행 명령, durable receipt, 남은 한계**를 남긴다. 새 근거는 `Nelyx/docs/validation/work3/`에, 큰 출력은 `Nelyx/artifacts/work3/`에 둔다.

### W3-00 — W2 폐기 기준선과 migration inventory

- [x] 최신 diff/checkpoint·제거된 artifact·공통 source/exports·provider·scripts·test/template/CI reference를 inventory한다.
- 진행 결과: `fa1ccf6`의 clean 기준선 826 tracked files·source hashes·package/exports/provider/scripts 및 Deno reference 1,165개를 기록했다. 제거된 세 artifact 경로, W2 미완료/실패/physical 공백과 RN desktop notVerified를 분리했다. [기준선](Nelyx/docs/work3-baseline.md), [inventory](Nelyx/docs/validation/work3/baseline-v1.json).
- 선행: 없음. 산출물: `work3-baseline.md`, source/hash inventory, current→target·keep/remove/archive 표.
- 검사: W2 완료/실패/미검증 범위를 분리하고 RN desktop의 초기 상태를 전부 notVerified로 기록한다. W2 paused checkpoint의 다음 Deno 작업을 active queue에서 제외한다.

### W3-01 — upstream 공급·버전 cohort·toolchain pin

- [ ] RNW/RNM/RNL·React/RN/Hermes/CLI/Metro/Babel/codegen·native toolchain의 첫 호환 matrix를 확정한다. RNL source를 위 SHA로 고정하고 license·source/patch·npm pack recipe를 작성한다.
- 진행 결과: **PARTIAL**. 세 독립 package/lock과 actual React/Fabric 버전 검사, public registry 재조회, 고정 RNL CLI/codegen build·4 tarballs 및 repo 밖 peer install·installed codegen이 PASS-scoped다. 원래 MIT license·native/template inputs·source/patch/hash를 보존했다. target native/Hermes·matching Skia SDK의 전 범위는 아직 미완료다. [호환·공급](Nelyx/docs/work3-desktop-compatibility.md).
- 선행: W3-00. 산출물: `work3-desktop-compatibility.md`, platform dependency locks, RNL upstream manifest.
- 검사: peer 충돌 없는 target별 install, `workspace:*` 없는 RNL tarball 외부 install, matching Hermes runtime/header/compiler와 native SDK identity. supply 미확보와 native build 실패를 구분한다.

### W3-02 — 세 desktop host의 bare RN 실행

- [ ] 임시 native projects에서 core View/Text/TextInput, AppRegistry, Hermes JS/JSI 호출, layout/focus/resize/close를 실제로 실행한다. Linux는 playground와 repo 밖 Metro consumer를 모두 검사한다.
- 진행 결과: **PARTIAL**. Windows x64 RNW/Fabric/실제 Hermes JSI runtime properties·한글 View/Text/TextInput·자동 UIA focus·resize/minimize/restore·normal close 및 server 없는 Release bundle/maps는 PASS-scoped다. Linux는 새 independent tarball consumer의 정식 RN Release bundle과 matching Debug Hermes/GTK에서 실제 mount·한글 Text·native focus·native edit→별도 React Text·resize·normal close가 PASS-scoped다. C++ New Architecture flags와 Modern RuntimeScheduler task 경로를 일치시켜 React microtask/render update를 실행했다. GPU·physical 입력·Release native는 미검증이다. Mac 독립 Metro Release bundle/map은 PASS-scoped이며 native build/runtime은 사용자 범위 조정에 따라 SKIPPED/notVerified다. [Windows host](Nelyx/docs/validation/work3/receipts/rnw-runtime-v3.json), [Linux bundle identity](Nelyx/docs/validation/work3/rnl-core-bundle-identity-v4.json), [Linux clean runtime v6](Nelyx/docs/validation/work3/rnl-core-native-runtime-v6.json).
- 선행: W3-01. 산출물: RNW/RNM/RNL host smoke receipt 및 release bundle/asset/source-map 결과.
- 검사: 아직 Nelyx renderer가 없어도 정상 host 실행·종료를 입증한다. Linux component/event/TurboModule/Metro 공백을 source 위치와 함께 기록한다. Mac 환경이 없으면 해당 검사는 SKIPPED/notVerified이며 합격 처리하지 않는다.

### W3-03 — desktop custom component·GPU surface 선행 spike

- [ ] 세 target에서 native component mount·JSI와 Graphite surface의 실제 표시를 연결한다. Windows Composition, macOS CAMetalLayer, Linux GTK/GDK의 surface strategy를 결정한다.
- 진행 결과: **PARTIAL**. Windows spec/codegen/C++ Fabric component·same-LUID D3D11 shared NT texture/fence import·Graphite/native Vulkan 실제 pixels가 Radeon 780M·RTX 4060 각각 PASS-scoped다. Linux는 외부 tarball consumer의 handwritten Fabric descriptor·UI-owner View factory hook·320×160 GtkPicture·실제 native→JS event·normal close/disposal을 구현하고 검사했다. 이어 실제 native Graphite replay→GPU copy→modifier DMA-BUF exporter와 GTK window-surface adapter를 구현하고 전체 host 링크를 확인했다. immutable frame·FD/native owner·완료 확인 및 drain 거부 경계를 구성했으며, 실제 GTK metadata/owner/ref 검사는 GPU 생성 없이 통과했다. Fabric/frame clock과 SDK source 연결은 구성했고 제품 admission·native 서비스/오류 경계·미확인 자원 복구는 남는다. Apple은 코드 구성, Linux GPU 실행은 사용자 요청으로 검증 범위에서 제외했다. 실패한 receipts도 보존했다. [surface ADR](Nelyx/docs/work3-desktop-surface-adr.md), [Linux component runtime](Nelyx/docs/validation/work3/rnl-surface-native-runtime-v2.json), [DMA-BUF 코드](Nelyx/docs/work3-linux-dmabuf.md).
- 선행: 해당 target W3-02 + matching Skia SDK 확보. 산출물: `work3-desktop-surface-adr.md`, target별 clear/rect/한글/image·resize/close·retirement receipt.
- 검사: RN hierarchy 안의 clipping/overlay/input/scale가 맞고 CPU blit·별도 창·이중 swapchain 우회가 없다. 기술적으로 부족하면 필요한 port/patch와 중단 조건을 확정한다. 대규모 파일 이동은 이 판단 뒤에 진행한다.

### W3-04 — runner 의존성 경계와 앱 디렉터리 개편

- [ ] 공통 `src`를 유지하며 여섯 target runner의 package/lock/config/bootstrap과 native project 경계를 만든다. Linux 0.81 cohort를 확실히 격리한다.
- 진행 결과: **PARTIAL**. 제품 `@nelyx/metro/runner-config`가 runner의 독립 install에서 preset·RN/React/framework와 exact Fabric 버전을 확인하고 own node roots/cache·명시적 source mappings·다른 cohort/target 거부를 구현한다. Windows/macOS/iOS/Linux 실제 cohort와 negative controls, Windows/Linux 공유 SDK source Metro가 PASS-scoped다. 동일 runner 내부 nested dependency만 허용하고 React/RN facade를 고정했다. 설치된 public exports를 기준으로 공통 source의 타입 경로도 생성한다. 외부 iOS/macOS `<target>/runner`의 실제 packed install·타입·source alias 없는 Metro·codegen·native project 경로 검사가 통과했다. v41에서 Windows 기본 testbed/template의 독립 package/lock·native project·명령과 실제 packed native 실행을 연결했다. 다른 target 기본 roots는 남는다. [Windows 기본 runner](Nelyx/docs/work3-windows-runner.md), [공통 RN 서비스·resolver 결과](Nelyx/docs/work3-sdk-rn-services.md), [packed Apple](Nelyx/docs/work3-apple-supply.md). v45는 기본 iOS/macOS testbed/template의 독립 package/lock·native projects·SDK App/main·공개 source hook 공급·일반 install/ci·자산 Metro/codegen·source relocation을 검증했다. Linux/Android/Web의 기본 독립 roots는 남는다. [기본 Apple runner](Nelyx/docs/work3-apple-default-runners.md).
- 선행: W3-01/02, 해당 desktop W3-03의 전략 확정. 산출물: testbed runner 구조·root workspaces·TS/project config·dependency resolver.
- 검사: 공통 앱은 core만 import, target resolver/native codegen이 다른 cohort의 RN/React를 선택하지 않음, native sourceDir·entry/bundle 위치와 package roots가 일치함.

### W3-05 — core/provider/config와 breaking API migration

- [ ] runtime/host identity에서 Deno 값을 제거하고 RN 구현·runtime version·artifact·capability·지원 cohort를 descriptor에 추가한다. 현 `nelyx.provider/v3`와 config의 새 schema migration을 정의한다.
- 진행 결과: **PARTIAL**. Core identity의 Deno/raw 값을 제거하고 6개 `nelyx.provider/v4`·`nelyx.app/v2`·validator/schema/generator와 exact React/RN/framework/Hermes cohort를 구성했다. Linux X11/Wayland는 별도 unsupported RN profile이다. v1/v3/raw config·기존 desktop openApplication은 actionable error로 거절하고, 새 desktop/Apple SDK entry는 RN registration signature만 구성하며 native 실행 근거를 승계하지 않는다. Android는 실제 React/RN cohort 검사·새 Gradle public metadata 경로를 포함한 Release emulator 회귀를 통과했다. 제품 runner roots·CLI/template의 Deno graph·공통 등록/수명 연결은 남는다. [전환 결과](Nelyx/docs/work3-provider-migration.md).
- 선행: W3-00/01, W3-03. 산출물: schema/validator/default/config/generator·platform public API·migration 문서.
- 검사: 옛 raw/Deno config는 actionable error로 거절, 새 RN profile은 구현 전 unsupported, 다른 target/profile의 evidence·GPU capability를 재사용하지 않음. core는 React/JSI/OS 구현 dependency를 갖지 않음.

### W3-06 — Android에서 RN 공통 서비스 추출

- effect 수명 보완: 실제 React StrictMode와 live Activity replay·opening 중 최신 metrics·이전 drain 대기·stale callback 거부가 통과했다. 외부 interaction은 caller-owned이며 application별 서비스만 해제한다. 실제 Android/Linux 회귀와 Apple 코드 검사도 최종 SDK로 통과했다. Fabric reload·성공적인 제품 renderer/수명 admission은 남는다. [최신 결과](Nelyx/docs/work3-rn-surface-lifetime.md).
- [ ] AppRegistry/bootstrap·asset·clock·metrics/visibility·surface/lifecycle를 RN 공통 adapter로 추출하고 platform differences를 주입한다. AppState와 TextInput 지원을 OS별로 조사한다.
- 최신 보완: native binding/visibility/backing metric gate와 실패 시 asset lease 해제를 공통 surface에 추가했다. 실제 Linux SDK pool의 숫자형 PNG·폰트 로딩/해제, Android 새 APK 전체 회귀 및 Apple 새 packed 공통 코드 graph를 확인했다. 108개 계약·392 imports/26 controls가 통과한다. 성공적인 Linux renderer admission과 StrictMode effect replay는 남는다. [결과](Nelyx/docs/work3-linux-sdk-surface.md).
- 진행 결과: **PARTIAL**. 실제 registration·assets·environment·interaction/controls·surface·visibility/frame polling을 `backends/react-native/`로 옮기고 Android가 GPU policy·native view 속성·자산 pool·TextInput 지원 정책을 주입한다. 초기화 실패 owner 보존·atomic asset publication·late callback 차단과 actual React/native RN/Hermes 검사를 구성했다. 51개 계약·타입·direct-import, Release API33 software emulator에서 첫 프레임·자산/실패·background/resize·30 remount/drain·10 runtime restart·native 제출/retirement·recording 실패·slot 상한 회귀가 PASS-scoped다. iOS/macOS adapter와 실제 공급·packed Metro/codegen도 구성했다. per-view backing/occlusion·generation/drain admission·StrictMode/full reload/loss 및 다른 target native port는 후속 관문이다. [현재 RN composition 결과](Nelyx/docs/work3-rn-composition.md).
- 선행: W3-04/05. 산출물: `backends/react-native/`의 실제 구현, Android adapter migration.
- 검사: 기존 Android resource/text/admission/retirement·emulator policy를 보존하며 common source에 Android-only 가정을 남기지 않음. target별 등록 함수는 단순 re-export wrapper가 아님.

### W3-07 — Skia GPU/context와 RN binding build graph 분리

- [ ] Dawn 전용 window/context를 target-neutral 계약과 backend 구현으로 나누고 native Vulkan을 RN JSI에 연결한다. 공통 core/rendering과 package generated source를 동기화한다.
- 진행 결과: **PARTIAL**. 공통 GPU/window 계약·Dawn 분리, 실제 Vulkan platform adapter·RN native package/CMake·SDK 도구를 구성했다. 독립 Windows/Linux tarball의 전체 generic JSI·core·GPU·platform 및 원본 m153 SVG/Skottie/SG/resources/JSON/WebP·고정 libwebp 빌드가 통과했다. 각각 335개 compile unit/13개 archive에서 Dawn/m154 include 유입을 검사했고 원본 모듈 C++ 145개의 no-RTTI 플래그도 확인했다. Windows 실제 adapter의 GPU 픽셀·retirement·정책·owner close·실패 poison이 통과했다. Linux matching Hermes의 standalone 전체 API 검증에 이어 실제 RNL host 설치·CallInvoker·local asset/font/GTK screenshot 서비스와 host/VM 10회 종료를 연결했다. 두 Linux 검증의 Skia GPU 생성은 0회다. 공통 pixmap encoder는 Android의 deferred/raster/Graphite texture 12개 왕복 검사를 통과했다. 최신 bootstrap APK 회귀와 이전 APK의 30 remount/10 restart·native 실패 주입 근거를 구분한다. v36은 실제 same-LUID texture/fence import·Graphite replay/upload·D3D pixels와 native consumer ACK/bounds/drain을 두 GPU에서 통과했다. 최신 Windows/Linux 전체 packed binding·Windows 실제 CPU API와 Linux matching Hermes CPU/cold Windows guards 회귀도 통과했다. v36 당시 제품 Composition/Fabric/SDK handoff와 창 표시 관문은 미완료/FAIL이었다. v40/v41의 제품 SDK·정상 수명·실제 창 결과는 별도 최신 근거이며, 전체 failure/generation/reload/loss는 남는다. [최신 Windows import 결과](Nelyx/docs/work3-windows-import.md). [GPU 경계](Nelyx/docs/work3-gpu-context.md), [제품 패키지 결과](Nelyx/docs/work3-vulkan-package.md), [실제 RNL host](Nelyx/docs/work3-rnl-skia-host.md).
- 선행: W3-03 전략, W3-05/06. 산출물: context/surface interfaces, Windows/Linux native Vulkan adapter, target별 native build recipes/source audit.
- 검사: 단일 process에 중복 Skia/Dawn 없음, matching headers/CRT/PIC/JSI ABI·text modules, bounded admission와 실제 GPU retirement·checked teardown. 공통 native core는 RN/GTK/AppKit/RNW를 import하지 않음.

### W3-08 — Windows RNW provider·native library 구현

- v41 최신 진행: **PARTIAL**. Windows 기본 runner/native project·공통 main/SDK AppSession/GraphiteRenderer와 서비스를 실제 tarball 소비 앱으로 실행했다. 합성 한글 편집·counter2·native surface 재마운트3·ready4/closed4·native retirement26·창 PNG/한글/React UI·정상 GPU/UI 종료가 통과했다. cold-init/failure/StrictMode/장기 stress/DPI/minimize/reload/loss와 CLI 공급은 남는다. 과거 흰 창 FAIL과 같은 byte의 v40 대조 PASS는 원인 미확정으로 보존한다. [최신 기본 runner](Nelyx/docs/work3-windows-runner.md), [SDK 연결](Nelyx/docs/work3-windows-sdk.md).

- [ ] RNW Fabric spec/codegen·Component View·JSI module/library 등록·renderer 서비스와 platform application/surface/controls를 구현한다. 최상위 window/reload는 RNW가 소유한다.
- 이전 v36 진행 결과 (historical): **PARTIAL**. 실제 RNW21 module/CallInvoker/local asset/DirectWrite/CPU API·checked binding close를 구성했다. v36 제품 native Device의 실제 texture/fence import·Graphite/D3D pixels·consumer ACK/lease bounds/drain은 두 GPU에서 통과했다. Fabric/Composition/screenshot/same-device factory·SDK provider와 async frame/전체 runtime 수명 연결은 미완료다. [Actual native import](Nelyx/docs/work3-windows-import.md). native GDI control은 캡처되지만 실제 RNW visible root/marker와 monitor crop 표시 검사는 FAIL이며 원인은 미확정이다. [Windows binding](Nelyx/docs/work3-windows-binding.md), [Composition/device](Nelyx/docs/work3-windows-composition.md).
- 선행: Windows W3-03, W3-04~07. 산출물: `packages/rn/windows`, Windows SDK provider/runner, x64 Debug/Release receipts.
- 검사: 실제 RN window·native identity·한글/asset/UTF-16 hit/range·DPI/resize/zero-size/visibility/queued close·tracked drain. raw HWND W2 결과와 새 receipt를 분리한다. ARM64는 별도 상태로 둔다.

### W3-09 — macOS RNM provider·Apple packaging 구현

- 최신 코드(v51): RNCore invalidate·dealloc·reload·fatal-JS가 SDK/native drain과 Core VM finalization ACK를 기다리도록 구성했다. protocol3/API3 native C validator·strong lease·bounded waiter/deadline·native 완료 증명을 연결했다. Linux Hermes C++ fixture20 healthy generations/실패·late ACK·경쟁200 rounds, RN0.83 JSI compile·실제 추가 ivar/init 구문의 portable ObjC++ grammar, contracts136·fresh v4 packed source/emitted23개·거부 controls5개가 통과했다. 실제 Apple ObjC++/ARC/Foundation/Metal 실행은 제외한다. [v51 근거](Nelyx/docs/work3-apple-forced-teardown.md).

- 이전 코드(v50): native 설치 이전 host protocol2 preflight, native API2·JS hardware Metal 준비·owner/view/runtime drain gate를 연결해 Apple source profile을 implemented/notVerified로 구성했다. 실제 Linux Hermes marker20 generations/잘못된 host7 cases, RN0.83 JSI compile, fresh packed source18개·metadata 거부 controls2가 통과했다. forced host teardown/invalidation/fatal-JS 경계는 남으며 native 실행 제외를 유지한다. [v50 근거](Nelyx/docs/work3-apple-provider-admission.md).

- 이전 코드(v49): 일반 View의 JS registry/producer → worker GPU retirement → UI layer ACK와 runtime pending drain을 구성했다. 실제 Linux Hermes30 cycles/JSI capture60개/실패8 cases, RN0.83 portable headers compile와 새 Apple packed source7개·types/Metro/codegen이 통과했다. Apple provider admission/source-hook identity gate는 남으며 native 실행은 제외한다. [v49 근거](Nelyx/docs/work3-apple-view-owner.md).

- 기존 Apple 코드(v33): process 설치 예약/rollback·확인 후 재시도/미확인 보존, publication 해제 뒤 ACK, closed off-owner invalidate와 drain 중 recycle 지연 코드를 추가했다. 실제 Hermes 경계·RN0.83 compile·119계약과 새 packed macOS562/iOS556·타입/codegen/각9 framework DSL이 통과했다. provider admission·제품 host hook 공급과 일반 per-view/강제 native teardown 경계는 남으며 Apple native 실행은 제외한다. [최신 근거](Nelyx/docs/work3-apple-install.md), [v32 pipeline](Nelyx/docs/work3-apple-runtime.md).
- [ ] RNM Fabric 등록·Apple JSI/NSView/layer와 SDK application/surface/controls를 연결한다. podspec/autolink·Graphite/Dawn prebuilt·target-only packaging을 정리한다.
- 진행 결과: **PARTIAL (Apple 코드 구성 범위)**. 고정 RNM 0.83.0 공식 native project·runner와 Debug/Release entry를 구성했다. 실제 154.1.0 iOS/macOS 공급 archive·public header·framework tree·architecture를 고정하고 pod helper가 변경된 supplier bytes를 거부한다. macOS-only 설치는 다른 Apple supplier package를 요구하지 않는다. supplier 자체 Dawn의 추가 OS slice는 남는다. 설치된 packed SDK의 공통 서비스 7개·559-module macOS Metro·real Fabric/TurboModule codegen·CocoaPods DSL 검사가 통과했다. 기존 Apple binding의 AppKit import·main-thread screen snapshot·창별 backing scale 코드도 정리했다. 후속 per-view backing/occlusion·generation 코드는 위 최신 결과로 구분한다. runtime shutdown/drain admission은 남으며 native build/Metal 실행은 사용자 범위에서 제외한다. [Apple 코드](Nelyx/docs/work3-apple-code.md), [실제 공급·packed 결과](Nelyx/docs/work3-apple-supply.md).
- 선행: macOS W3-03, W3-04~07. 산출물: RNM native runner·provider, Apple Silicon Debug/Release·독립 packed consumer receipts.
- 검사: 실제 NSView output·text/asset·scale/monitor change·occlusion/detach/reload/close·GPU drain. Intel 및 다른 Xcode/min-OS는 각각 근거를 남긴다.

### W3-10 — Linux RN component/codegen/JSI port

- packaged native host 보완: RNL-owned 실제 GTK root·display DMA-BUF factory·2단계 runtime activation/cleanup을 재사용 API로 구성했다. 패키지 API의 native 링크·host/VM 10회와 JSI 준비 후 활성화 실패 cleanup이 통과했다. metadata 모드 검증이며 hardware branch는 컴파일만 했고 v19 당시 제품 admission은 unsupported였다. 최신 등록 코드는 native host gate로 연결했으며 hardware qualification은 notVerified다. [최신 결과](Nelyx/docs/work3-linux-packaged-host.md).
- [ ] 필요한 Fabric descriptor/props/event/command 등록과 TurboModule/JSI 설치를 구현한다. upstream 공백은 고정 patch로 보완하며 새 GTK component를 CMake/autolink에 연결한다.
- 진행 결과: **PARTIAL**. SkiaView descriptor/props/factory·JS-owner binding·GTK clock/events·AppState·TextInput port에 Image facade와 SourceCode module을 추가했다. public context 재결합·실제 Metro 숫자형 PNG의 bundle URI/SDK pool·native metric gate를 연결했다. 독립 consumer의 설치 1,633개 파일·public types·Metro·전체 native 링크와 host/VM 10회에서 70개 경계 사례·view 60개 등록/해제·예상 오류 40개·84회 clock tick이 통과했다. GPU 생성은 0회다. HTTP asset·system font·제품 renderer/수명 admission은 남는다. [SDK surface 결과](Nelyx/docs/work3-linux-sdk-surface.md).
- 선행: Linux W3-02/03, W3-04~07. 산출물: `packages/rn/linux`, RNL patch manifest·generator/registration tests.
- 검사: codegen stamp만 생성하고 성공으로 끝내지 않음. repo 밖 앱에서 native component props/layout/event round-trip·JSI installation·asset/text·dispose를 실제 확인한다. runtime 교체 뒤 stale event/JSI 접근을 차단한다.

### W3-11 — Linux GTK·Vulkan provider와 X11/Wayland 실행

- 최신 SDK admission: 실제 native host 상태·window system·runtime 세대와 per-view hardware/backing gate를 연결했다. 두 WSI는 각 backend 검사 조건을 가진 코드 구현이며 hardware qualification은 각각 notVerified다. 실제 native 검사는 X11 MetadataOnly이고, Wayland native 성공이나 hardware SDK 앱 수명 완료를 주장하지 않는다. OS close·full reload·fatal JS의 SDK AppSession stop/drain handshake와 호환 component 수정의 Fast Refresh를 실제 native host/대역 renderer로 검증했다. hook reset·compile 오류 복구·공식 DevSettings 전체 reload도 통과했다. SDK module refresh/reconnect·source stress·loss/recovery는 남는다. [최신 Metro 결과](Nelyx/docs/work3-linux-metro-policy.md), [admission 결과](Nelyx/docs/work3-linux-sdk-admission.md).
- packaged native host 보완: RNL-owned 실제 GTK root·display DMA-BUF factory·2단계 runtime activation/cleanup을 재사용 API로 구성했다. 패키지 API의 native 링크·host/VM 10회와 JSI 준비 후 활성화 실패 cleanup이 통과했다. metadata 모드 검증이며 hardware branch는 컴파일만 했고 v19 당시 제품 admission은 unsupported였다. 최신 등록 코드는 native host gate로 연결했으며 hardware qualification은 notVerified다. [최신 결과](Nelyx/docs/work3-linux-packaged-host.md).
- [ ] 선택한 GTK surface import/owner 경로, SDK application/surface/controls와 runner를 구현한다. X11과 Wayland profile을 나누고 target default 선택을 명시한다.
- 진행 결과: **PARTIAL**. bounded Graphite→GPU copy→immutable DMA-BUF 코드·Fabric/clock·native AppState/controls/editing과 SDK native surface gate를 구성했다. 실제 shared surface factory에서 숫자형 PNG·폰트를 로딩한 뒤 GPU 미초기화를 거부하고 asset pool을 해제한다. 이 v17 metadata 진단의 renderer 생성은 0회였고 당시 profile은 unsupported였다. 최신 guarded 구현은 위 v22 결과로 구분한다. 입력/AppState·context 재결합·자산 실패 cleanup을 host/VM 10회 검증했다. 성공적인 renderer/수명 admission·StrictMode·reload/loss/복구·Release 배포는 남는다. GPU allocation/copy/import/표시 실행은 사용자 범위에서 제외한다. [코드·검증 범위](Nelyx/docs/work3-linux-sdk-surface.md).
- 선행: W3-10. 산출물: Linux hardware Debug/Release·WSI별 runtime receipt 및 unsupported reason.
- 검사: native GPU frame/text/image·resize/scale/minimize/focus/close·retirement/drain·실제 GDK backend/driver. Ubuntu 24.04 baseline 소비와 WSLg diagnostic을 분리한다. 한 WSI의 PASS로 다른 WSI를 implemented/scoped로 올리지 않는다.

### W3-12 — 입력·편집·semantics desktop port

- [ ] RNW/RNM/RNL controls와 필요한 native editing/semantics extension을 연결한다. keyboard/shortcut/mouse/wheel/clipboard·focus traversal·selection/composing/candidate geometry/revision을 core 계약으로 전달한다.
- 진행 결과: **PARTIAL**. Linux single-line GTK port의 native revision/command ack·focus/replace·UTF-16 selection과 SDK editing binding을 실제 연결했다. stale props/commands·split surrogate·editable=false·종료 후 signal/command 거부와 연속 replacement의 최종 native text가 통과했다. composing·selection direction·multiline은 unavailable이며 실제 IME/reader·추가 controls/입력 stress와 다른 target port는 남는다. [결과](Nelyx/docs/work3-linux-native-services.md).
- 선행: 해당 target W3-08/09/11. 산출물: editing/capability table·native event trace·Windows UIA/macOS AX/Linux AT-SPI 결과.
- 검사: native bare TextInput 대조, 반복 한글 조합·중간 selection/취소/commit·DPI candidate 위치·screen reader 실제 수행. RN TextInput props나 JS accessibility tree 존재만으로 composing/reader PASS를 주장하지 않는다. Skia scene의 semantic node와 RN overlay의 중복도 검사한다.

### W3-13 — Fast Refresh·full reload·종료·실패 수명

- 최신 진행(v54): Android runtime-owned callback registry/weak ticket와 JNI peer ownership을 보완했다. 실제 Hermes11 VM·callback650 owner 해제·legacy worker 파괴 negative control, actual Debug CLI refresh3/full reload, pending native HTTP2회를 replacement Ready 이후 완료하는 검증이 PASS-scoped다. v53 Ready 실패와 v54 startup/tool 실패는 원본 보존·원인 미확정이며 전체 SDK/GPU/UI/Core forced/fatal drain은 남는다. [v54 결과](Nelyx/docs/work3-android-reload.md).

- Apple runtime 종료 코드 보완(v33): v32 SDK→UI→JS registry/async→native GPU retirement→surface/I/O/main-job drain에 설치 예약/rollback, ACK 전 publication 해제/JS capture 정리, closed foreign invalidate와 recycle 정책을 추가했다. 실제 Hermes 경계와 새 pack/types/Metro/codegen/DSL을 확인했다. Apple native 실행은 제외하며 provider admission·제품 host hook 공급과 강제 native teardown 경계는 남는다. [v33 결과](Nelyx/docs/work3-apple-install.md).

- Apple URI 종료 코드 보완(v31): 로더 close가 completion을 버리고 session cancel을 요청하며 queued file/main 작업은 closed state를 확인한다. 실제 native 작업 종료까지 job slot을, payload 마지막 해제까지 byte reservation을 유지한다. portable state/file/경쟁과 공통 native compile·독립 pack이 통과했다. streamStatus를 기다리는 전체 SDK/native shutdown ACK와 GPU retirement는 미완료이며 Apple native 실행은 제외한다. [v31 결과](Nelyx/docs/work3-apple-stream.md).
- Apple async owner 코드 보완(v30): 세 Promise 경로의 callback은 JS owner에서 정산/해제하며 native 작업에는 weak-ID를 넘긴다. RCTJSThread invalidate·foreign seal과 callback 보존, capacity/중복/지연 완료 차단을 구성했다. portable 경쟁·실제 Linux Hermes JSI·공통 native compile·독립 Apple pack 검사가 통과했다. 전체 SDK/native drain과 I/O 취소/budget은 미완료다. [v30 결과](Nelyx/docs/work3-apple-async-owner.md).
- Apple per-view 코드 보완(v29): view/backing generation과 native metrics gate, frame/surface/notification callback token, display-link identity와 실패한 recycle 거부를 구성했다. 실제 React 대역·portable C++/sanitizer·packed Metro/codegen/Pods DSL이 통과했다. runtime-owned SDK shutdown/drain/service callback 코드는 남으며 Apple native 실행은 제외한다. [v29 결과](Nelyx/docs/work3-apple-per-view.md).
- Linux Metro 정책 보완(v28): 실제 HTTP/RN WebSocket/HMRClient/React Refresh에서 본문9회 상태 보존, hook 추가 reset과 다음 수정 보존, compile 오류 중 UI 유지와 유효 수정 복구, 공식 DevSettings의 fresh Hermes 전체 reload가 통과했다. signature adapter·raw JS shutdown microtask checkpoint·종료 socket 정책을 보완했다. HMR62개/HTTP5개/source snapshot14개와 Release10세대·10선택 실패 경계를 보존했다. renderer는 대역이며 SDK module refresh/reconnect·source stress/loss/recovery는 남는다. [v28 결과](Nelyx/docs/work3-linux-metro-policy.md).
- Linux fatal JS 보완: 세대별 ExceptionsManager·RuntimeScheduler·JS owner queue의 첫 fatal 오류를 checked GTK/SDK/native 종료로 연결했다. 실제 React mount/effect·runApplication·후속 timer/rAF/interval/microtask·fatal 보고13개와 standalone queue1개, 이전31경계가 같은 native bytes로 통과했다. 두 정상10세대 reload는 soft20·malformed catch40·이전 VM의 늦은 native payload9건 거부를 포함한다. renderer는 대역이며 hook/signature refresh 경계·source stress/loss/recovery는 남는다. [v26 결과](Nelyx/docs/work3-linux-fatal-js.md).
- Linux 시작/reload 실패 보완: bundle load/eval·missing/malformed AppRegistry 실패를 presentation 전에 종료 정리로 연결하고, 등록되지 않은 surface의 stop assertion을 피한다. 초기10/replacement10·factory/identity3·Config 거부1·외부 quit 뒤 실제late SDK callback1의25 검사와 기존6 경계가 같은 native bytes로 통과했다. 두 정상10세대 reload와 같은host activate도 통과했다. renderer는 대역이며 상태 보존 Fast Refresh·source stress/loss/recovery는 남는다. [v25 결과](Nelyx/docs/work3-linux-reload-failures.md).
- Linux full reload 보완: 기존 VM의 전체 번들 재평가를 제거했다. 이전 GTK/SDK/native drain·JS thread join 뒤 fresh ConfigFactory의 창/host/Hermes를 열며 GApplication을 유지한다. 실제 공개 JS API와 Unix 소켓 snapshot을 각각9 reload/10 세대로 실행해 상태 reset·세대·stale 요청 차단·revision2..10 실행을 확인했다. SDK renderer는 대역이며 실제 GPU·상태 보존 Fast Refresh·factory/bundle/quit 실패 matrix의 완료 증명은 아니다. [최신 결과](Nelyx/docs/work3-linux-runtime-reload.md).
- Linux SDK 종료 보완: 일반 GTK main loop를 유지한 채 effect owner/AppSession·renderer·자산 정리를 기다린 뒤 native JSI cleanup으로 넘어간다. 실제 RN/Hermes/GTK host10회와 대역 renderer의40ms JS 타이머, SDK drain 실패·10초 확인 timeout을 포함한6 실패 경계가 통과했다. native owner/late/GPU0, JS/UI 콜백10/10 취소다. metadata 거부는 유지되며 hardware GPU 실행·full reload/recovery 증명은 아니다. [최신 결과](Nelyx/docs/work3-linux-sdk-shutdown.md).
- Linux lease drain 보완: 실제 native 자원 해제 뒤 반환되는 장치당 3개 move-only lease와 최대 5초 frame 대기를 연결했다. timeout 보존·native late release 뒤 명시적 재시도를 생산 gate의 Windows/Linux/sanitizer 경합 검사로 확인했고, 최신 native 링크·host 10회·실패 경계 및 Windows canonical GPU context 회귀가 통과했다. Linux hardware 완료·자동 runtime 복구·전체 GPU close deadline 증명은 아니다. [최신 lease 결과](Nelyx/docs/work3-linux-lease-drain.md).
- Linux 종료 보완: GTK 준비→창/native surface 해제→JS cleanup 순서를 구성했다. 실제 Cairo renderer 해제 10회와 부분 RNL VM의 owner/idempotence/restart 경계, GTK 준비/JS cleanup/활성화/component 초기화 실패 4개 검사가 통과했다. 남은 DMA-BUF lease의 drain 거부는 유지하며 GPU/compositor hardware 완료·비동기 drain 재시도·full reload 증명은 아니다. [최신 종료 결과](Nelyx/docs/work3-linux-native-shutdown.md).
- packaged native host 보완: RNL-owned 실제 GTK root·display DMA-BUF factory·2단계 runtime activation/cleanup을 재사용 API로 구성했다. 패키지 API의 native 링크·host/VM 10회와 JSI 준비 후 활성화 실패 cleanup이 통과했다. metadata 모드 검증이며 hardware branch는 컴파일만 했고 v19 당시 제품 admission은 unsupported였다. 최신 등록 코드는 native host gate로 연결했으며 hardware qualification은 notVerified다. [최신 결과](Nelyx/docs/work3-linux-packaged-host.md).
- [ ] RN 기본 reload와 Nelyx AppSession/ViewRuntime/native owner의 closing protocol을 연결한다. JS exception·startup/mount 실패·context/device/surface loss·retirement 실패·OS close 중 GPU 사용을 처리한다.
- 진행 결과: **PARTIAL**. effect owner별 callback/asset lease, 이전 application drain 뒤 replacement view, interaction 서비스 lease와 opening 중 최신 metrics를 구현했다. 실제 React19.1.4/19.2 StrictMode 및 React19.2 Activity의 drain 전/후 복귀·stale callback·최종 해제가 통과했다. native/GPU 포트는 대역이며 Fabric StrictMode/full reload 증명은 아니다. 최종 Android 30 remount/10 restart 및 Linux host/VM 10회·60 view 등록/해제에서 native owner 0개·JS/UI 콜백 10/30개 취소·late callback 0회를 확인했다. 기존 GTK 초기화/UI 종료 실패는 같은 native bytes로 exit2·보존/abort 없음이 유지된다. Fabric full reload/Fast Refresh·opening/drain 실패 범위 확장·GPU drain/loss/복구는 남는다. [최신 결과](Nelyx/docs/work3-rn-surface-lifetime.md).
- 선행: W3-07 및 해당 target 구현. 산출물: runtime-generation·native owner protocol, 실패 주입/실제 loss 분리 receipts.
- 검사: Fast Refresh state 유지와 full restart reset 정책, 30 remount/10 restart·연속 resize/close·stale callback 차단·retained lease 해제. 관측 불확실한 GPU work를 완료로 간주하고 context/runtime을 먼저 버리지 않음.

### W3-14 — Android/iOS/Web 전환 회귀와 미구현 연결

- 최신 진행(v54): Android source5개만 바뀐 새 SkiaRN 패키지를 일반 설치/Debug native build·ELF12·compile24·actual installed SHA로 검증했다. 실제 refresh3/full reload와 late-native2가 통과했다. Apple/common member와 다른 package archive는 동일하다. ARM64/Release의 최신 source 재빌드와 전체 target/physical qualification은 별도다. [v54 근거](Nelyx/docs/work3-android-reload.md).

- 최신 공통 변경 재검사: 새 Android RN0.83.1 Release APK의 첫 프레임·30 remount/10 restart·asset/codec·notification/recording/admission·provenance가 통과했다. iOS 새 packed consumer는 554-module Metro·타입·실제 codegen·9개 framework DSL을 통과했다. Apple은 코드 검사만 수행했다. [최신 근거](Nelyx/docs/work3-linux-sdk-surface.md).
- [ ] Android를 검증한 새 cohort로 올려 actual emulator/native ABI/source-map 회귀를 수행한다. iOS의 unsupported entry를 Apple RN 서비스로 구현하고 Web 기존 경로를 새 구조에 연결한다.
- 진행 결과: **PARTIAL**. iOS RN 0.83.10 공식 template·`ios/runner` 독립 packed lock·native project와 실제 SDK 공통 서비스 코드를 구성했다. source alias 없는 553-module Metro·7개 공통 source·real codegen·actual framework 공급 검사가 통과했다. per-view/native 수명 admission은 남고 iOS native build/simulator/device 실행은 사용자 범위에서 제외했다. Android RN 0.83.1 공통 서비스·provider 전환 회귀와 app-owned binary supplier의 새 Release build/첫 프레임이 통과했다. Android 0.83.10 upgrade와 Web 구조 전환 회귀는 남는다.
- 선행: W3-04~07, Apple 공급 정리. 산출물: Android x86_64/ARM64 build·hardware 상태, iOS build/runtime, Web static/browser receipts.
- 검사: Android hardware-only default와 software emulator 분리·미해결 IME 유지, iOS simulator/physical 분리, Web 단일 CanvasKit/WebGL2·context loss/DOM/StrictMode. 공통 변경의 PASS를 native target 지원 완료로 확장하지 않음.

### W3-15 — CLI·Metro preset·bootstrap 생성 전환

- 최신 진행(v54): fresh 실제 CLI dev의 native build/install/refresh3/full reload counter0/Ready가 통과했다. 같은 이전 APK의 isolated reload 대조 실험도 성공해 v53 Ready90초 실패의 원인은 미확정이다. 새 Metro startup AbortError도 보존했다. Windows/Linux/Web public dev adapter와 deterministic cold-start/reload budget은 남는다. [v54 근거](Nelyx/docs/work3-android-reload.md).

- 최신 진행(v53): Android/iOS/macOS 표준 RN dev server와 host gate·실행/중단 연결을 구성했다. Android Fast Refresh3/state2/native scene pixels 및 native 404 Promise 거절, Apple source server, POSIX signal/port guard, 실제 Gradle daemon 포함9 process 취소가 PASS-scoped다. full reload Ready90초는 FAIL을 유지하며 native guard와 Windows/Linux/Web dev는 남는다. [v53 근거](Nelyx/docs/work3-native-development.md).

- 최신 진행(v52): 여섯 target main doctor/prepare/build/run/pack과 직접 public subpath를 연결했다. Android fresh Gradle/immutable APK·native ELF/HBC/relative map·adb launch·실제 emulator, Web actual static package/tar/relocated CLI browser/POSIX signal close를 검사했다. Apple source/prepare/host gates와 portable framework links, Windows retained native 회귀 및 Linux cross-host native input5357 doctor도 통과했다. 공통 dev/reload/Fast Refresh·native Debug/failure/loss·자동 공급·CI/release는 남는다. [v52 근거](Nelyx/docs/work3-multi-target-cli.md).

- [ ] `nelyx doctor/build/run/dev/pack --target ...`가 실제 RN platform CLI/native project를 호출하도록 바꾼다. target별 Metro preset·entry/assets/source-map·release bundling과 명시 dependency 준비를 구현한다.
- 진행 결과: **PARTIAL**. v42 Windows CLI doctor/prepare/build/run/pack이 독립 runner의 실제 app-owned builder와 bootstrap/assets를 호출한다. 외부 일반 설치·native build·305 files ZIP·이동 CLI/native 직접 실행·정상 종료를 확인했다. Debug/dev/reload, 다른 target CLI와 자동 native acquisition/build supplier는 남는다. [Windows CLI](Nelyx/docs/work3-windows-cli.md). v45의 public Apple runtime helper는 app-owned runner/Podfile에서 exact-source hook을 공급한다. main `nelyx` Apple command adapter나 native 실행 PASS를 뜻하지 않는다. [v45](Nelyx/docs/work3-apple-default-runners.md).
- 선행: W3-04/05 및 해당 target 실행. 산출물: SDK CLI/Metro 모듈별 exports·types·generated bootstrap·command documentation.
- 검사: caller cwd/target root·non-Windows shell·호스트 OS 제약·표준 RN dev server·release bundle·process shutdown. import/app startup에서 SDK 다운로드나 Metro를 실행하지 않음. Linux는 upstream esbuild playground와 정식 Metro 경로를 구분한다.

### W3-16 — template·독립 tarball 소비·package 경계

- 최신 진행(v54): 새 독립 Android consumer의 정상 설치/타입/bundle과 Skia archive/installed1279 files를 대조했다. 변경은 Android source5개뿐이며 Apple/common members와 Core/SDK/Metro/CLI archive는 동일하다. 실패·source 복원·exact Debug APK·compile inputs와 normal archive/lock을 보존했다. [v54 근거](Nelyx/docs/work3-android-reload.md).

- [ ] template sync/create와 packed consumer를 새 runner 구조로 바꾼다. `@nelyx/core/sdk/skia-rn/skia-web/metro/cli` 및 RNL 공급 tarball을 repo 밖에서 소비한다.
- 진행 결과: **PARTIAL**. 외부 iOS/macOS `<target>/runner`에서 실제 Core/SDK/SkiaRN/Metro tarball·selected Apple supplier를 normal peer install로 소비하고 public type mapping·alias 없는 Metro·real codegen·native project 경로를 검사했다. v41 Windows 기본 template/testbed package/lock과 외부 Core/SDK/SkiaRN/Metro1736 files·Metro565·실제 native build/runtime, source-only relocation install/types도 통과했다. v42는 CLI 포함 다섯 tarballs installed1,746/lock691, 일반 lifecycle 설치·testbed npm ci와 native ZIP 이동 실행까지 확인했다. 다른 target 기본 roots·Web-only 및 전체 native 공급 전환은 남는다. [Windows 기본 runner](Nelyx/docs/work3-windows-runner.md), [packed Apple 결과](Nelyx/docs/work3-apple-supply.md). v44는 Deno source/types 없는 SDK tarball285와 다섯 패키지 installed1,672/lock691/Metro565, Web-only 네 tarballs·Chrome154/WebGL2 close0을 새로 검증했다. [v44](Nelyx/docs/work3-sdk-deno-retirement.md). v45는 자체 lock을 포함한 기본 iOS/macOS template의 fresh normal install·전체 자체/supplier archive byte·public types·자산 Metro/codegen과 별도 source relocation ci를 확인했다. [v45](Nelyx/docs/work3-apple-default-runners.md).
- 선행: W3-04~15의 대상 기능. 산출물: target template·consumer projects·pack manifests·JS/types/Metro/native codegen receipts.
- 검사: source/generated header·native project·license가 package 안에 포함, repo private path·root node_modules·캐시·workspace symlink 없이 build/run. core-only·Web-only 설치가 RN desktop/native SDK를 요구하지 않음.

### W3-17 — Deno 제품 경로 최종 제거와 검사 재구성

- [ ] 7절 목록의 obsolete package/export/host/FFI/serializer/compile/runner/config/script/CI dependency를 제거한다. portable runtime test를 Node/tsx로, native FFI 테스트를 C++/RN harness로 전환한다.
- 진행 결과: **PARTIAL**. v41~43 CLI·Metro·default runner의 Deno 경로 퇴역에 이어 v44는 SDK low-level Deno backend/export/raw Rust bridge/native shipping·SkiaDeno workspace/types·이전 payload·관련 fixture/도구/W2 workflow를 원본 보존 후 제거했다. 퇴역168/보존 원본196, stale emitted output·extraneous lock 부재, Deno-free root check와 contracts127을 확인했다. native FFI wire 검사는 canonical C++ raster pixels2·잘못된 frame21 거부로 이관했고 fresh Windows/Web 소비·native ZIP 이동/정상 종료를 검증했다. 다른 target 기본 runner·native failure/reload/loss의 전체 coverage·새 portable/native CI·release gate는 남으므로 W3-17 최종 체크박스는 유지한다. [SDK/Skia 퇴역 결과](Nelyx/docs/work3-sdk-deno-retirement.md).
- 선행: RN 대체 경로·회귀가 준비된 target부터 단계적으로 진행, 최종 삭제 완료는 W3-08~16 뒤. 산출물: Deno 제거 diff·dependency graph audit·새 root check.
- 검사: active source·package/lock/template/generated bootstrap/CLI/CI에는 Deno runtime·types·Laufey/Cargo bridge dependency가 없음. 역사 문서·원래 notice의 문자열은 별도 inventory로 보존한다. 테스트를 삭제해 coverage 공백을 감추지 않음.

### W3-18 — native 공급·release 배포·license closure

- [ ] RNW NuGet/Windows App SDK/Hermes, Apple Pods/xcframework, Linux runtime/binding/GTK 배포 요구와 Skia/Dawn inputs를 고정한다. 필요하면 새 RN 전용 binary package를 제공한다.
- 진행 결과: **PARTIAL**. 실제 Apple 154.1.0 archive integrity·framework hash·public declaration·selected architecture와 CocoaPods DSL을 고정했다. Android binary는 app-owned optional peer로 전환하고 Release 실행을 확인했다. 전체 symbol/compiler/min-OS·license/SBOM·release closure는 남는다. [공급 결과](Nelyx/docs/work3-apple-supply.md).
- 선행: W3-01 및 target build, W3-16/17. 산출물: exact artifact catalog/hash/header/ABI/architecture/min-OS·notices/SBOM·target pack recipes.
- 검사: Windows installable/unpackaged release와 runtime dependencies, macOS `.app`/서명·notarization 범위, Linux 선택 배포 형식·shared dependencies·glibc/GTK 최소 버전. 최종 앱은 Node/Metro/Deno 개발 서버 없이 실행한다. consumer native build에는 해당 RN toolchain이 필요함을 명시한다.

### W3-19 — portable·native CI와 hardware acceptance 분리

- [ ] root portable build/types/import/provider/contracts/consumer job, Windows native build, macOS Xcode build, Linux Ubuntu 24.04 CMake/Metro consumer job을 추가한다. 필요한 GPU/GUI job은 별도 runner로 구성한다.
- 선행: W3-15~18. 산출물: W3 workflows·bounded scripts·receipt upload·source/artifact identity.
- 검사: 원격 실제 실행과 로컬 recipe 결과 분리, headless build와 hardware frame/IME/reader/scanout 분리. 실패 receipt도 보존하며 optional job SKIPPED를 PASS로 합산하지 않음.

### W3-20 — 문서·지원 matrix·upgrade 정리

- [ ] README·platforms/Skia/SDK/tooling docs, generator/template instructions, provider defaults·profile·native supply·license/upgrade 문서를 최종 구조와 일치시킨다.
- 선행: 관련 구현마다 갱신, 최종 정합은 W3-17~19 뒤. 산출물: W3 migration/운영/지원 matrix·W2 historical 안내.
- 검사: 옛 Deno 명령을 현행 실행 절차로 안내하지 않음. RNW/RNM/RNL의 version·build/runtime/hardware/배포 한계를 target별로 명시한다. internal implementation 세부사항을 앱 사용자 flow에 노출하지 않음.

### W3-21 — 최종 qualification과 남은 작업 인계

- [ ] clean checkout + 독립 소비 + target runtime/lifetime/input + release/dependency closure를 audit한다. native heap/GPU resource budget·장기 reload·실제 loss/recovery·다중 DPI/monitor를 검증한다.
- 선행: W3-00~20에서 필수 관문 완료. 산출물: `work3-result.md`, target별 evidence index·checkpoint·미완료 목록.
- 검사: build/automation/emulator와 hardware·physical reader·scanout·signing/clean-machine를 구분한다. 필수 환경이나 기능이 미검증이면 전체는 PARTIAL이고 해당 platform/profile을 qualified로 선언하지 않는다.

## 9. 실행 순서·진행 기준

**첫 착수는 W3-00 → W3-01 → W3-02이며, 즉시 대규모 삭제/이동부터 시작하지 않는다.** host smoke 다음 W3-03에서 세 desktop의 custom surface 전략을 검증하고 W3-04~07의 구조·계약·binding 변경을 진행한다. W3-08/09/10~11은 해당 OS별 실행 환경과 선행 관문을 갖춘 순서로 수행한다. W3-12~14로 입력/수명/기존 target을 보강하고 W3-15~19로 도구·독립 소비·Deno 제거·공급·CI를 완료한 뒤 W3-20~21을 audit한다.

| 관문 | 합격에 필요한 근거 | 관련 작업 | 현재 상태 |
| --- | --- | --- | --- |
| G3-0 기준선·공급 | current→target inventory·정확한 upstream/cohort·외부 설치 가능한 입력 | W3-00/01 | PARTIAL: 기준선 완료, JS 공급/설치 PASS-scoped, 전 native/SDK identity 미완료 |
| G3-1 RN host | Windows/Linux bare native RN·Hermes/JSI·외부 Metro·release smoke; Apple 코드 구성 | W3-02 | PARTIAL: Windows host PASS-scoped; Linux headless mount/focus/edit→React/resize/close PASS-scoped, Release native/hardware 별도; Mac native 범위 제외 SKIPPED |
| G3-2 native surface | 실제 RN hierarchy 안의 Graphite·GPU retirement·resize/close·owner 전략 | W3-03/07 | PARTIAL: Windows 두 hardware GPU Graphite/shared texture 표시·정상 retirement PASS-scoped; Linux/Mac·loss/reload 미완료 |
| G3-3 구조·API | runner isolation·RN 공통 서비스·새 provider/config·direct imports | W3-04~07 | notVerified |
| G3-4 desktop runtime | RNW/RNM/RNL의 실제 component·assets/text/input/lifetime | W3-08~13 | notVerified |
| G3-5 기존 target | Android 회귀·iOS 연결·Web 기존 기능 유지 | W3-14 | PARTIAL: v47 Android RN0.83.10 양 ABI native build/x64 emulator 회귀·Web browser 및 기존 iOS packed 코드 검사 PASS-scoped; physical/IME/reader·전체 target regression 별도 |
| G3-6 도구·독립 소비 | CLI/templates·tarball/native build/run·Deno 없는 제품 graph | W3-15~17 | notVerified |
| G3-7 배포·CI | exact inputs/notices·독립 release·OS별 remote CI | W3-18/19 | notVerified |
| G3-8 최종 audit | 문서/지원 matrix·physical/hardware/실패/장기 예산·clean-machine 범위 | W3-20/21 | notVerified |

기술 공백이 나오면 source 위치·관측 결과·필요한 patch·다음 검증을 checkpoint에 남긴다. Mac 실행 환경이나 Linux 실제 GPU가 없으면 해당 관문을 미완료로 유지하면서 그 환경에 의존하지 않는 공통/native build/package 작업을 진행한다. 문서만 읽고 모든 target을 unsupported로 남기는 것을 구현 완료로 삼지 않는다.

Windows Composition/native Vulkan 통합 또는 Linux Fabric component/GTK GPU import에 근본 제약이 확인되면 해당 target의 확장 작업을 구체화한다. Deno fallback이나 다른 GPU의 자동 default 변경을 해법으로 쓰지 않는다. renderer 정책 변경이 필요해진 경우에만 확인된 대안·diff·실행 결과를 갖춘 별도 결정으로 다룬다.

### 폐기한 W2 작업과의 연결

| W2 항목 | W3 처리 |
| --- | --- |
| W2-00/01 baseline·core/SDK·no-barrel | 구현 기반 유지, W3-00/04/05/16에서 새 graph로 검증 |
| W2-02 서비스/provider | W3-05/06/12로 RN identity·공통 서비스·native 입력 개정 |
| W2-03 Metro→Deno, W2-04 raw/native spike | 개발 경로 폐기, W3-02/03/13/15로 RN host/reload 검증 |
| W2-05 Skia 분리·prebuilt | source/provenance 재사용, W3-07/18에서 RN port·공급 정합 |
| W2-06 Android | W3-06/14 회귀·cohort 전환 |
| W2-07 Windows Deno | W3-08 새 RNW 구현; Vulkan/text 알고리즘만 선별 재사용 |
| W2-08 Web, W2-09 iOS | W3-14 유지/연결; 과거 미완료 범위 유지 |
| W2-10 macOS Deno | 계획 폐기, W3-09 RNM/Apple binding 구현 |
| W2-11 Linux Deno | 계획 폐기, W3-10/11 RNL/GTK/JSI port; Vulkan/font source 선별 재사용 |
| W2-12/13 CLI·공급·CI | W3-15~19의 RN build/pack/native supply로 교체 |
| W2-14 qualification | 미해결 실패/공백을 W3-12/13/21로 승계, 과거 PASS는 historical |

## 10. 검증과 evidence 기록 규칙

| 검증 수준 | 확인하는 것 | 추가로 필요한 것 |
| --- | --- | --- |
| 문서·source review | 책임/경로·링크·pin·migration/작업 의존성 | 설치·native build·실행 |
| portable build/types/import/contracts | public API·JS/선언 `.js` 경로·no-barrel·서비스/lease 의미 | JSI/Fabric/native OS runtime |
| target native build/codegen | matching RN/JSI/Hermes·SDK·native registration·pack inputs | 실제 mount/event/frame/close |
| headless/emulator/VM runtime | 해당 환경에서 실제 component·frame·diagnostic·lifetime | hardware device/physical input/reader/scanout |
| hardware desktop runtime | RN hierarchy·native GPU·context/retirement·WSI별 출력 | 인간의 IME/reader, 실제 scanout·장기 budget·배포 |
| 독립 release/clean-machine | bundle/assets/runtime closure·install/startup/종료 | signing/notarization 또는 미수행 qualification |

receipt에는 source commit/tree/hash·package/lock/toolchain·cohort와 RN 구현·Hermes/JSI/native SDK·renderer/GPU implementation·loaded binary identity·OS/architecture/display backend·command/exit/duration/log·tracked drain 범위·실패/미검증 항목을 기록한다. provider는 해당 profile의 새 receipt만 참조한다.

`PASS`, `PASS-scoped`, `PARTIAL`, `FAIL`, `SKIPPED`, `notVerified`, `unsupported`를 구분한다. GPU retirement는 present/scanout이 아니다. software Vulkan 진단은 hardware profile PASS가 아니다. binary notice collection은 완전한 배포 license closure가 아니다. 빌드만 된 profile의 qualification을 runtime scoped로 올리지 않는다.

v45의 현행 `npm.cmd run check`는 Deno runtime/workspace/types 없이 Node 공통/portable·독립 RN Metro 소비를 검사하며 실제 통과했다. SDK의 retired source/export/native shipping·SkiaDeno workspace/type와 extraneous lock 항목도 제거했다. 해당 graph 제거 PASS를 target별 native failure/reload/loss·CI/release·전체 qualification PASS로 확대하지 않는다. 각 단계에서는 변경에 맞는 계약·외부 소비·native 실행을 선택하고 실패나 새 우려 없이 같은 전체 검사를 반복하지 않는다.

## 11. 최종 완료 조건

- [ ] Windows/Linux 최상위 앱이 지정한 RN 플랫폼에서 실행되며 Hermes/JSI·native View·Skia surface·SDK provider의 실제 연결이 입증됐다. Apple macOS/iOS는 해당 runner/provider/binding 코드가 구성되고 가능한 source·types·Metro·pack 검사를 통과했다.
- [ ] Windows native Vulkan renderer의 RN hierarchy·artifact/header/ABI·text/image·admission/retirement/drain이 검증됐다. Linux native Vulkan/Graphite는 구현·빌드와 RN 연결을 구성하고 사용자 요청으로 제외한 GPU 미검증 범위를 기록했다. Apple Dawn/Metal은 코드·target 공급을 구성하고 native 미검증 범위를 기록했다. X11/Wayland·architecture·GPU별 상태가 분리돼 있다.
- [ ] core와 공통 `src`에는 플랫폼 구현 의존성이 없고 SDK가 RN 공통 서비스와 OS 차이를 구성한다. package exports·생성 bootstrap·TS/JS·native source graph에 barrel이 없다.
- [ ] runner cohort·install·Metro/codegen/native project가 일치하며 외부 앱이 source symlink나 repo 캐시 없이 packed SDK를 소비한다.
- [ ] 제품·template·root 기본 check·CLI·CI에서 Deno desktop/FFI/Metro→Deno/compile/Laufey runtime dependency가 제거됐다. 역사 자료는 보존됐다.
- [ ] RN Fast Refresh/full reload/close·startup/recording/retirement/loss 실패에서 runtime/view/resource owner의 수명과 retained lease가 안전하게 처리됐다.
- [ ] Android/Web 회귀와 iOS 연결의 실제 범위가 기록됐으며 한국어 composing·physical input/accessibility·장기 budget 등 필수 공백은 해결되거나 명시적인 PARTIAL로 남았다.
- [ ] RN target별 toolchain/native 공급·package license·release/runtime dependencies·CI·clean-machine/signing 범위와 문서가 최종 구조와 일치한다.

**전체 W3 완료는 사용자 범위 조정에 맞춘 필수 관문과 위 조건이 충족됐을 때만 판정한다.** Apple native 실행·GPU·서명 및 Linux GPU 미검증은 후속 qualification으로 보존하며 이번 완료를 막지 않는다. 각 target의 요구된 구현과 빌드·portable 검사는 계속 필요하다. 코드 구성 완료와 native 지원 qualification은 별개다.

## 12. 주요 조사 자료

모두 2026-10-09 KST에 확인했다. Linux는 위 commit source를 우선 근거로 고정했고 RNW/RNM는 registry metadata와 공식 release/source를 함께 확인했다. 실행 단계에서는 변경 가능성이 있는 dist-tag와 toolchain 요구를 다시 확인하고 선택한 exact pin을 기록한다.

| 자료 | 계획에서 사용한 근거 |
| --- | --- |
| [RNW 시작](https://microsoft.github.io/react-native-windows/docs/getting-started/), [New Architecture](https://microsoft.github.io/react-native-windows/docs/new-architecture/), [native Fabric component](https://microsoft.github.io/react-native-windows/docs/native-platform-components/) | native host·Composition·codegen/library 연결 |
| [RNW 0.83.2 metadata](https://registry.npmjs.org/react-native-windows/0.83.2), [0.84.0 metadata](https://registry.npmjs.org/react-native-windows/0.84.0), [0.84 release](https://github.com/microsoft/react-native-windows/releases/tag/react-native-windows_v0.84.0) | peer/version candidate·최신 toolchain 비교 |
| [RNM 시작](https://microsoft.github.io/react-native-macos/docs/getting-started), [0.83.0 release](https://github.com/microsoft/react-native-macos/releases/tag/react-native-macos%400.83.0), [0.83.0 metadata](https://registry.npmjs.org/react-native-macos/0.83.0) | macOS runner·RN exact peer·공식 공급 |
| [고정 RNL README](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/README.md), [native modules](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/docs/native-modules.md), [packaging](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/docs/packaging.md) | alpha·GTK·제한·module/배포 설계와 실제 source의 차이 |
| [RNL codegen driver](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/scripts/codegen/run.js), [Hermes pin](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/vnext/cmake/FetchHermes.cmake), [package peer](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/packages/%40lucid-softworks/react-native-linux/package.json) | Fabric stub·TurboModule 생성·cohort/JSI source pin |
| [RNL CLI bundler](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/packages/%40lucid-softworks/cli/src/commands/bundleLinux.ts), [playground bundler](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/apps/playground/bundle.mjs), [template Metro](https://github.com/lucid-softworks/react-native-linux/blob/9412cf605c7cc77f920916401926ff9a9873ecd3/template/metro.config.js) | Metro 외부 앱과 esbuild/vendor smoke 분리 |
| [RN Skia upstream package](https://github.com/Shopify/react-native-skia/blob/main/packages/skia/package.json), [desktop 지원 논의](https://github.com/Shopify/react-native-skia/issues/2058) | Apple 입력·Windows 전용 backend 필요; pinned Nelyx fork의 실제 source를 별도 우선 확인 |
| [W2 최신 인계](Nelyx/docs/validation/work2/interim-2026-10-09-linux-desktop.md), [checkpoint](Nelyx/docs/validation/work2/pause-checkpoint-2026-10-09-linux-desktop.json), [Skia 구조](Nelyx/skia/README.md), [기존 공급/CI 결과](Nelyx/docs/research/work2-native-delivery-ci-result.md) | 재사용할 source·과거 receipt·실패와 제거된 artifacts의 한계 |
