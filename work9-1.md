# work9-1 — 1부: 범위·기준선·Windows 호스트·공통 경계

> 2026-11-07: 사용자 요청으로 본문의 독립 테스트·감사·실험 명령을 폐기했다. 이전 검증 기록과 미완료 판정은 보존하며, 현행 확인·정리 기준은 [전체 목차의 정리 안내](work9.md)를 따른다.

작성: **2026-11-05 KST** · 갱신: **2026-11-09 KST** · 상태: **App SDK 단일 host·RNW 소스 이식 계획 교정 / 구현 PARTIAL**

> **2026-11-08 사용자 교정:** Windows 제품 host는 **App SDK 하나**다. 플랫폼 API는 **Windows RNW / Android·iOS RN / macOS RNM / Linux RNL**의 실제 소스를 가져와 수정·사용한다. W9B-00-H의 App SDK 단일 경로·RNW public clipboard 구현 근거는 [종료한 work9-b](work9-b.md#35-w9b-00-h-구현과-이번-검증)에 보존한다. **2026-11-09 이후 현재 실행·남은 의무는 [work9-c](work9-c.md), 우선 host/API 계약은 [work9-c §1.1](work9-c.md#11-host와-플랫폼-api-소스-이식-계약)을 따른다.** 기존 두 host 검증은 과거 근거다.

[전체 목차](work9.md) · [다음: 2부](work9-2.md)

**범위:** 원문 §1–4·§7. Windows/Web 우선 범위, work8 기준점, Windows App SDK·RNW 선별 재사용, 최소 공통 embedder 경계를 다룬다.

**실행 순서:** Windows/Web 1차는 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따른다. 이후 **[4부의 Android·Linux 2차](work9-4.md) → [후속 5부의 iOS·macOS 3차](work9-5.md)**로 진행하며 후속 플랫폼을 Windows/Web 1차 완료의 선행 조건으로 두지 않는다.

차수 전환의 **완료는 앞선 차수 모든 대상의 W9-13 기술 gate 통과**를 뜻한다. 물리 입력·성능·기본값 전환은 W9-14의 대상별 별도 판정이며, 그 미수락을 기술 완료나 다음 차수 착수와 혼동하지 않는다. [완료·차수 전환 기준](work9-3.md#125-차수-전환과-완료-판정)

## 1. 이번 계획의 결정과 범위

**1차 개발·완료 대상은 Windows와 Web이다.** Windows는 Windows App SDK + C++/WinRT host로 전환하고 현재 Graphite/Vulkan renderer를 재사용한다. Web은 기존 DOM·Worker host에서 **threaded와 non-shared single-worker를 함께** 개발한다. 현재 paragraph 의미 보존에는 고정한 owned m153 CanvasKit 공급을 사용하고 npm 의존성은 타입 선언에 사용한다. 공통 기능은 Windows와 두 Web profile에 같은 사례를 연결해 진행한다.

**Windows/Web 1차 다음은 [4부의 Android·Linux 2차](work9-4.md)이며, 그다음은 [후속 5부의 iOS·macOS 3차](work9-5.md)다.** 플랫폼별 설계·미완료 항목은 보존하고 해당 차수에서 toolchain·prototype·입력 adapter·배포를 진행한다. 후속 플랫폼과 모바일 RN 소스 추출은 Windows/Web 1차 완료의 선행 조건으로 두지 않는다. Web의 브라우저 helper도 실제 재현 사례가 있을 때만 선별한다. 채택 범위·의존성 제거·입력 상태 계약·실행 검증은 [§11](work9-2.md#11-web모바일에서-유지할-범위)을 따른다.

**Windows의 RNW 소스 실제 이식은 1차 필수 작업이다.** 필요한 플랫폼 API 구현을 선별 복사하고 App SDK·Nelyx Core에 맞게 수정·사용한다. 기존 Nelyx 직접 구현은 교체 소비자와 동작 비교의 기반이며 RNW 소스 도입을 생략할 이유가 아니다. Android/iOS는 RN, macOS는 RNM, Linux는 RNL의 플랫폼 API 소스에 같은 원칙을 적용한다. 구체적인 소스와 변경 경계는 [§4.1](#41-windows-rnw-소스-선별-재사용)과 [2부 §11.6](work9-2.md#116-도입-순서와-의존성-gate)을 따른다.

**`packages/cupertino`·`packages/material`은 C++ 엔진을 사용하는 TypeScript 디자인 패키지로 유지한다.** 두 패키지의 구현 언어·Widget/State·theme·컴포넌트 동작을 C++로 옮기는 작업은 계획에 포함하지 않는다. C++ core는 공통 layout·editing·gesture 판정·retained scene·compositor를 소유하며, 디자인 패키지는 TypeScript framework/adapter를 통해 이를 사용한다. 먼저 현재 Windows/Web의 작은 실행 경로와 원래 API의 실행 모델을 확인하고 필요한 공통 경계만 확장한다.

`work8.md`, `work8-1.md`, `work8-2.md`, `work8-2a.md`, `work8-3.md`는 **CLOSED / SUPERSEDED**다. 사용자 요청으로 원문 작성일에 맞춘 history 요약 5개에 설계·실행·실패와 미완료 상태를 보존하고 루트 원문은 삭제했다. [work8 보관 목차](history/26/11/04/work8-summary.md)에서 각 요약으로 이동할 수 있다. 이후 일정·완료 조건·플랫폼 선택은 이 문서가 우선한다.

분할 전 검토에서는 작업 순서와 의존성을 검토해 **work9 문서만 수정**했다. 당시 CMake·API audit·CLI/runner·host 검사와 Windows/Web 공식 문서를 대조했다. 제품 소스·공급은 변경하지 않았고 빌드·기능 테스트·API audit·성능 측정을 새로 실행하지 않았다. 아래 구현 단계와 검증표는 **앞으로 수행할 작업**이다.

Windows/Web 기술 완료, 기존 공개 API 호환, 제품의 물리 입력·체감 성능 수락을 각각 판정한다. **Windows/Web 1차 완료와 전체 플랫폼 완료를 구분**하고 후속 플랫폼은 계속 미완료로 남긴다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 IME/reader/trackpad·display/scanout `notVerified`를 이어받는다.

### 1.1 TypeScript 디자인 패키지와 C++ 엔진의 책임

이 경계는 1~5부의 모든 대상과 W9-06/08/13에 적용한다. **C++ 엔진 사용의 완료 조건은 원래 TypeScript 컴포넌트가 엔진 기능을 사용하는 것이며, 컴포넌트 자체의 C++ 재구현이 아니다.**

| 계층                                     | 유지할 구현과 책임                                                                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/cupertino`·`packages/material` | TypeScript Widget/State·구성/build·theme/token/default·상태별 색/shape 선택·form/validation·controlled value와 callback·route/overlay/localization·컴포넌트 animation/controller 정책. 원래 import·생성자·확장 지점과 실행 코드를 유지     |
| TypeScript framework·engine adapter      | Canonical Element/State/Key/context를 유지하고 선언형 node·제약/스타일·paint 명령·semantics 의도·자원 참조를 versioned wire로 전달. 명시 App-owned C++ 동기 paragraph 질의와 C++ 결과·입력/terminal을 원래 TypeScript 객체·callback에 연결 |
| C++ engine·graphics provider             | 전달된 설정으로 최종 layout/좌표·text shaping/편집·hit-test/gesture 판정·scroll/motion 기본 연산·scene/paint 준비·raster/composition·자원 수명을 수행. 디자인의 theme/default·컴포넌트 상태 기계·사용자 callback을 별도로 복제하지 않음    |
| OS/Web host                              | Surface·clock·입력/IME·접근성 peer·서비스·배포를 연결. 같은 TypeScript 디자인 패키지를 실행하고 플랫폼별 디자인 Widget 구현을 따로 만들지 않음                                                                                             |

두 디자인 패키지의 소스/배포는 TypeScript·JS/선언·기존 fonts/icons/shader 등 자산으로 유지한다. 패키지 아래에 C++/Objective-C++ Widget 소스·native build target·엔진 binary를 넣거나 TypeScript class를 C++ Widget의 이름만 남은 wrapper로 바꾸지 않는다. 공통 native 구현과 공급은 engine/provider/host 경계에 둔다.

엔진이 이미 제공하는 기능 안에서 theme·상태별 스타일·callback·컴포넌트 구성을 바꾸거나 새로 조합하는 작업은 TypeScript 패키지/adapter에서 해결한다. 새 공통 engine 연산이 필요한 경우에만 C++/wire/capability를 확장한다. Geometry 계산 helper를 C++에 둘 수 있지만 디자인별 기본값·전환 규칙·State를 그 helper로 이전하지 않는다. 구체적인 연결·검증 기준은 [2부 §8.2](work9-2.md#82-디자인-패키지의-typescript-구현-유지)를 따른다.

## 2. work8에서 이어받는 기준점

Work8 종료 문서의 검토 기준은 HEAD **`b2f18fc12f7c`**와 당시 이미 존재한 `work8-2a.md`의 Flutter 비교 미커밋 변경이다. 해당 변경의 내용은 2a 보관 요약에 보존했다. 아래 숫자는 [2a의 마지막 구현 검증 기록](history/26/11/05/work8-2a-summary.md#이번-검증)이며 이번 문서 작업의 재검증 결과가 아니다.

| 항목                  | 종료 시점의 기록과 이월 경계                                                                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공통 engine·기존 host | C++/C ABI·TS client·ACK/NACK·layout/query·Widget diff·편집/semantics·bounded lazy list. Windows 자체 HWND와 Web 두 profile의 구간 구현                                                                                                  |
| 마지막 기능 검사      | Core **214/214**, API 검사 자체 **7/7**, lifecycle **3/3**, host **5/5**, 일반 runner **8/8**. 전체 공개 API 호환 성공이나 새 OS host의 성공을 뜻하지 않음                                                                              |
| 실제 실행 근거        | 해당 Testbed에서 SDK ACK 명령 **1210 = C++ transactionWork 1210**, layoutWork **445**, graphics record **14**, native extension **1**. 미이식 Widget 거부 대조와 ACK 전 `observed=false` 확인                                           |
| 공개 API 기준         | `public-api.json`의 **4개 패키지·834 subpath·4526 code export 발생 항목 + 15 non-code 항목**. Reexport를 포함하며 고유 기능 수나 완료율이 아님                                                                                          |
| 전체 API gate         | **FAIL / inputValid=false / compatible=false**. 전체 선언 동시 해석에서 의존 전역 충돌 81건, 원래 scope 차이 0건이라는 당시 기록. Workspace `skipLibCheck` 통과와 구별                                                                  |
| 공급                  | ABI major **2**, schema **2587795476**, `host-integration-candidate`, **33파일/4 font**. 마지막 source SHA-256은 `c69b2977dced7e94fb1f454b2ae7c9fa653938d6d5b3ad193057f3c70f2608f0`. 현재 소스/파일 hash는 다음 구현 실행에서 다시 확인 |
| 그래픽·메모리         | Affine/path/clip/stroke/shadow/opacity/blur와 단일 ledger의 일부 구현. 총 **768 MiB / GPU 예약 128 MiB**는 owned reservation/관측 정책이며 RSS·driver VRAM의 hard cap이 아님                                                            |
| 일반 프로젝트         | Windows/Web의 create/build/run/pack·7개 archive 설치 소비·두 디자인·설치 compiler 검사. `dev`는 build 후 run이며 generation reload는 없음                                                                                               |
| npm 종료              | 과거 install의 **0xC0000409 두 번**과 보완 후 runner 통과를 함께 보존. 원인 미확정이며 engine ledger 초과로 단정하지 않음                                                                                                               |

이전 문서의 69·117·184·193·211·242개 및 오래된 공급 hash는 각 실행 구간의 기록이다. 마지막 기록을 합산하거나 과거의 `fallbacks=0`을 현재 독립 계측으로 재사용하지 않는다.

### 이월 대응표

| work8의 미완료 범위                                                | work9 작업                                                                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| W8-00/01 범위·API 의미·플랫폼/공급 계약                            | W9-00/01/13                                                                                                |
| W8-02/08 최소 Android·Apple/Linux port와 graphics 복구             | 1차 Windows/Web은 W9-02/12-A, 2차 Android/Linux는 W9-12-B(Android)/03, 3차 iOS/macOS는 W9-12-B(iOS)/04     |
| W8-03/04 전체 gesture·motion·layout/text·invalidation              | W9-05/07/09/10                                                                                             |
| W8-05/06 Widget·list·focus/editing·semantics                       | W9-06/07                                                                                                   |
| W8-07 Material/Cupertino·overlay/navigation                        | W9-08                                                                                                      |
| W8-09/10 통합 기능·SDK/CLI/template·설치 공급                      | W9-13                                                                                                      |
| 2a P1 기존 Widget/Element/State/Key/context                        | W9-06                                                                                                      |
| 2a P2 layout/scroll/gesture/editing/paint/custom hook              | W9-05/06/07                                                                                                |
| 2a P3 전체 디자인·SDK API                                          | W9-08                                                                                                      |
| 2a P4 남은 host·reload·archive·예산/회수                           | 1차 W9-01/02/09/12-A/13, 2차 W9-12-B(Android)/03, 3차 W9-12-B(iOS)/04. 각 후속 대상의 W9-13/14는 별도 수행 |
| 2a P5 전체 통합·물리/성능                                          | W9-13/14                                                                                                   |
| Flutter 비교의 표현력·자원 재사용·frame clock·외부 콘텐츠·pressure | W9-05/07/09/10/11                                                                                          |

P0에서 보완한 원래 표면 고정·gate 입력·동작 의무·실제 경로 보고·복합 종료 처리는 유지할 기반이다. 전체 API gate가 실패하므로 P0 검사의 통과를 P1–P5 완료로 올리지 않는다.

## 3. 플랫폼별 채택 구조

| 대상    | 개발 차수          | 호스트·UI owner                                                                       | 그래픽 연결의 계획                                                                             | 필수 범위와 현재 상태                                                                                                                                                                                            |
| ------- | ------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows | **1차 우선**       | **Windows App SDK + C++/WinRT 단일 host**, RNW 플랫폼 API 소스 수정 이식             | 현재 **Skia Graphite/Vulkan → AppWindow의 HWND** 유지                                                    | Windows 11 x64. 독립 `windows-hwnd` 실행 target·profile·CLI 선택은 W9B-00-H에서 제거. HWND interop와 공통 Core/provider는 유지. RNW public clipboard 이식 완료·나머지 API 미완료                                                                                       |
| Web     | **1차 우선**       | 기존 Main·App worker·engine worker, 두 실행 profile                                   | 고정 owned `m153-nelyx-paragraph.5 / paragraph API 1·Picture API 2·font API 1`, npm CanvasKit은 타입 선언 | Windows의 Chrome·Edge를 초기 실제 브라우저 검증 대상으로 두고 정확한 버전은 W9-00에서 기록. 두 profile·전체 API·복구는 PARTIAL. 다른 browser/OS는 별도 검증 전 지원 완료로 표시하지 않음                         |
| Linux   | **2차 / 4부**      | **GTK4** host와 **RNL 플랫폼 API 수정 이식본**, GLib main context                       | Render worker의 **Graphite/Vulkan → DMA-BUF → GdkTexture → GTK snapshot**                      | GTK **4.22 이상**, Linux x86_64, **Wayland와 X11 각각**. RNL 원본의 toolkit/API 차이를 고정해 수정·이식하고 [4부](work9-4.md#5-linux--gtk4-호스트)의 완료 조건 적용. **미착수 / DEFERRED** |
| macOS   | **3차 / 후속 5부** | **AppKit** host와 **RNM 플랫폼 API 수정 이식본**, Objective-C++ adapter                      | **Skia Graphite/Metal → CAMetalLayer**                                                         | macOS **14 이상**, arm64 초기 계획. RNM 원본/수정·AppKit 실행과 공급 확인 필수. **미착수 / DEFERRED**. x86_64는 별도 target 상태                                                                                            |
| Android | **2차 / 4부**      | Activity/View·JNI + native engine, **RN Android 플랫폼 API 소스 수정 이식** | Native surface와 검증한 Skia 공급                                                              | standalone 두 ABI·emulator 실행 기반 **PARTIAL**. RN API별 원본/수정 이식과 기존 직접 구현의 소비자 교체는 잔여 의무                                                                                               |
| iOS     | **3차 / 후속 5부** | **UIKit** host와 **RN iOS 플랫폼 API 수정 이식본**, UITextInput       | Native Metal surface와 검증한 Skia 공급                                                        | RN 입력·접근성·서비스·scene/lifecycle 소스 이식과 공급을 수행. **미착수 / DEFERRED**                                                                                                      |

위 OS/ABI는 초기 검증 대상의 계획이다. W9-00에서는 **Windows App SDK/NuGet·Skia/Hermes/CRT·Emscripten/CanvasKit·실제 browser**의 정확한 버전·artifact hash·최저 환경을 고정한다. Android toolchain·GTK/GLib는 2차 착수 때, Xcode·Apple toolchain은 3차 착수 때 고정한다. `latest`나 로컬에 우연히 설치된 SDK를 제품 의존성으로 삼지 않는다. 다른 OS/ABI는 검사 전 지원 완료로 표시하지 않는다.

현재 [v2 CLI](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)는 Windows/Web/Android를 공급하며 Windows는 W9B-00-H에서 App SDK 단일 기본 선택으로 이관했다. 기존 [Linux template](Nelyx/sdk/tooling/cli/templates/nelyx-app/linux/CMakeLists.txt)의 RNL과 [macOS runner](Nelyx/sdk/tooling/cli/templates/nelyx-app/macos/runner/README.md)의 RNM은 해당 플랫폼 API 소스 선정의 출발점이다. 기존 runner 전체를 새 v2 host로 세지 않으며 필요한 소스를 추출·수정하고 실제 소비자를 이관한다.

## 4. Windows — Windows App SDK 호스트

**Windows App SDK의 실제 창 관리·dispatcher 수명을 사용하는 단일 Windows host로 통일한다.** 필요한 HWND/Win32 interop는 그 host 내부 구현이며 App SDK 없는 독립 실행 경로를 두지 않는다. RNW의 OS API 구현을 수정 이식하고 기존 Graphite/Vulkan renderer와 공통 C++ engine을 연결한다. AppWindow와 HWND interop의 근거는 [Microsoft AppWindow 안내](https://learn.microsoft.com/en-us/windows/apps/develop/ui/manage-app-windows)다.

W9B-00-H/W9-02-A에서는 **App SDK 단일 선택 → RNW 첫 API 수정 이식 → 실제 C++ scene·OS 동작 → resize·close → 설치 소비 실행**을 연결한다. App SDK 쪽으로 필요한 공통 코드를 분리하고 CLI/sample/template/공급을 이관한 뒤 독립 HWND target을 같은 묶음에서 제거한다. 과거 HWND 검증 기록은 보존하지만 별도 제품 host·필수 회귀 대조군으로 유지하지 않는다.

| 작업              | 고정할 계약·완료 증거                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시작·배포         | C++ host 실행 프로젝트에서 고정 NuGet을 참조하고 CMake core/provider를 연결. 초기 배포는 **unpackaged/self-contained**로 계획. 실행 프로젝트의 `WindowsAppSDKSelfContained=true`·`WindowsPackageType=None`과 UndockedRegFreeWinRT 초기화 포함 여부를 확인. 현재 Skia/Hermes와 호환되는 CRT 공급·DLL/metadata·license를 포함하고 전역 App SDK runtime·개발용 PATH가 없는 소비 환경에서 실행. Framework-dependent를 추가하면 bootstrap/runtime 설치 계약을 별도로 제공  |
| UI loop           | STA UI thread가 `Microsoft.UI.Dispatching.DispatcherQueueController`·AppWindow·HWND를 소유. 기존 USER32 pump와 통합하고 중첩 resize/modal loop도 검사. `Windows.System` dispatcher와 App SDK dispatcher 타입을 섞지 않음                                                                                                                                                                                                                                              |
| 실제 App SDK 사용 | 단순 link나 manifest 이름이 아니라 AppWindow 생성/interop·크기/표시/변경·dispatcher callback·종료를 실제로 실행. Host 보고에 `windows-app-sdk`와 정확한 runtime/package identity 포함                                                                                                                                                                                                                                                                                 |
| Surface           | 현재 [Vulkan/Graphite provider](Nelyx/engine/platform/windows/skia_provider.hpp)를 Render owner에서 재사용. UI가 HWND와 metrics lifetime을 보장하고 device/scene의 늦은 결과를 세대로 차단. HWND/WSI teardown은 GPU/provider hold drain 뒤 수행                                                                                                                                                                                                                       |
| DPI·resize        | Client 물리 px와 engine 논리 단위의 변환을 한 adapter에서 처리. `WM_DPICHANGED`·AppWindow 변경을 하나의 metrics revision으로 합치며, live resize·다중 모니터·최소화·zero-size·restore 때 이전/새 surface의 게시 순서를 검증                                                                                                                                                                                                                                           |
| 입력·접근성       | RNW의 keyboard/pointer/focus·IME·UIA·서비스 소스를 가져와 App SDK UI dispatcher와 Core document/mirror·게시 geometry에 연결. 기존 [TSF/UIA](Nelyx/engine/platform/windows/interaction.hpp)의 실제 소비자를 API별 이관. Keyboard/text 중복·capture 이탈·precision trackpad/wheel 구분·조합 종료를 확인                                                                                                                                                                                                                               |
| 종료              | Close 요청은 한 terminal로 합치고 신규 입력/작업 admission을 닫은 뒤 UI pump를 살린 채 App → Widget/client → Content/Render/provider → HWND/AppWindow → dispatcher/runtime 순서로 정리. 마지막 window close도 GPU hold drain 전 HWND 파괴나 `PostQuitMessage`로 이어지지 않게 처리. Queue 종료가 AppWindow를 파괴할 수 있으므로 최외곽 loop owner만 queue를 종료. UI callback을 기다리는 owner를 UI에서 blocking join하지 않으며 원래 오류와 cleanup 오류를 모두 보존 |

App SDK의 창 변경은 UI 호스트 전환이다. **D3D/ANGLE·Composition swapchain 전환은 이번 채택의 전제에 넣지 않는다.** 향후 다른 renderer를 추가할 때는 capability·픽셀·수명·실행 identity를 독립 검증한다.

배포와 dispatcher 수명은 [self-contained 배포](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/self-contained-deploy/deploy-self-contained-apps), [framework-dependent bootstrap](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/deploy-unpackaged-apps), [DispatcherQueue](https://learn.microsoft.com/en-us/windows/apps/develop/dispatcherqueue)를 기준으로 구현한다. Self-contained와 framework-dependent의 초기화 절차를 한 경로에 혼합하지 않는다.

Self-contained 설정을 CMake library에만 추가한 것으로 배포 완료 처리하지 않는다. 실행 프로젝트의 NuGet/MSBuild 출력과 설치본에서 초기화·필수 파일을 확인하고, CRT를 바꿀 때는 Skia/Hermes까지 ABI·allocator 해제 경계를 대조한다. 기존 HWND host의 성공을 새 App SDK host suite에 재사용하지 않고 시작 실패·마지막 창 닫기·시작 도중 종료도 같은 공급으로 검사한다.

### 4.1 Windows RNW 소스 선별 재사용

**RNW의 Windows 플랫폼 API 구현을 실제 가져와 수정·사용하는 것을 1차 기본 경로로 채택한다.** 원본의 OS 동작·상태/예외 처리·구독/해제 구현을 이식하며 기능·사례 참고만으로 대체하지 않는다. React/Fabric의 전달·소유권을 App SDK dispatcher와 Nelyx 값/handle·Core port로 수정한다. [RNW 공식 구조 설명](https://microsoft.github.io/react-native-windows/docs/new-architecture/)은 원본 구조의 배경이며 Nelyx renderer 도입 결정과 구별한다.

소스 기준은 실제 Windows runner 설치본의 **`react-native-windows@0.83.2`**다. 위치는 `sample/nelyx-testbed-app-2/windows/runner/node_modules/react-native-windows`이며 아래 RNW 경로는 그 안의 `Microsoft.ReactNative/` 기준이다. W9B-00-H에서 **public clipboard 서비스의 추출·수정·standalone compile/link·실제 OS 동작**을 연결했다. [provenance.json](Nelyx/engine/platform/windows/rnw/provenance.json)에 원본 commit/package integrity·원본/수정 hash·MIT license를 고정했다. 입력/IME/UIA/설정 등의 나머지 이식과 물리 입력 수락은 미완료다. 기존 RN/RNW·Hermes/JSI 공급은 자동 갱신하지 않는다.

| 범위                   | 확인한 소스와 재사용 후보                                                                                                                                            | Nelyx 적용 경계                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 기존 Nelyx 기반        | v2 `platform/windows/interaction.hpp`, 기존 `sdk/native/windows/TextInputService.h`·`SemanticsTextProvider.h`, `skia/native/host/windows/WindowsPrecisionTrackpad.h` | 기존 소비자·입력/편집/수명 계약과 비교 근거로 조사. RNW 수정 이식본으로 소비자를 연결하고 필요한 Core/mirror/세대 연결 코드는 유지. 기존 자체 구현의 존재로 RNW 소스 이식을 생략하지 않음                                        |
| Keyboard·pointer·focus | RNW `Utils/KeyboardUtils.cpp`, `Fabric/Composition/CompositionEventHandler.cpp`·`ReactNativeIsland.cpp`의 키 매핑·capture 이탈·focus·이벤트 연결/해제                | 필요한 OS handler와 사례를 추출. React tag·ComponentView hit-test·Fabric event emitter는 engine node/session·게시 geometry·canonical input으로 교체. Wheel을 precision trackpad의 contact/phase 증거로 바꾸지 않음 |
| TextInput·IME          | RNW `Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp`의 RichEdit/ITextHost·키/선택·입력 경계 처리                                                     | OS 입력 handler·동기 질의·조합/선택·예외 처리 구현을 실제 추출·수정. Fabric text state/layout·event emitter를 Core document/mirror/ACK·게시 paragraph로 바꾸며 필요한 native carrier의 역할과 수명을 명시  |
| UI Automation          | RNW `Fabric/Composition/CompositionDynamicAutomationProvider.cpp`·`CompositionRootAutomationProvider.cpp`의 fragment·pattern·focus/hosted child 연결                 | ComponentView/React tag/props를 Core semantic snapshot·node generation·게시 bounds에 매핑. Stale node·focus·range/action·종료를 실제 UIA peer에서 확인                                                             |
| OS 서비스·설정         | RNW `Modules/ClipboardModule.cpp`·`AccessibilityInfoModule.cpp`, `Fabric/Composition/Theme.cpp`의 clipboard·시스템 설정 조회/변경 알림                               | ReactContext/ReactPromise·RN dispatcher 대신 owned UI dispatcher·중립 결과/취소를 사용. 필요한 서비스부터 선택하고 늦은 완료·이벤트 구독을 close 때 정리                                                           |

**도입 순서:** 현재 W9B-00-H에서 RNW 원본/필요 API·기존 소비자 고정 → App SDK 단일 host·CLI/공급 이관과 독립 HWND target 제거 → 작은 서비스의 첫 실제 소스 복사·수정·소비자 교체·실행 → W9B-03/W9-07/08에서 입력·IME·UIA·환경/서비스 전체 이식 → W9-13에서 실제 설치 graph·이식 소스·출처·OS 동작/종료 확인. 전체 API의 동시 추출을 초기 host 연결의 선행 조건으로 두지는 않지만 **실제 이식 0개나 자체 구현/사례 참고만으로 RNW 이식 완료를 선언하지 않는다.**

수정 이식한 경로는 ReactNativeHost/ReactContext·FabricUIManager·ComponentView registry·React renderer의 실행 없이 동작해야 한다. 필요한 구현을 가진 원본 파일은 복사·분할·수정할 수 있고 결합된 타입/callback은 Nelyx 소유권으로 바꾼다. OS callback은 bounded Core port로 연결하며 RNW renderer/VM/scheduler를 추가 권위로 들이지 않는다. ContentIsland/Composition 결합이 있으면 해당 API의 실제 코드·App SDK 연결·미해결 범위를 적고, 이식 불가를 이유로 기능 전체를 자체 재작성한 결과를 이식 완료로 표시하지 않는다. 저작권·MIT 및 해당 파일의 제3자 고지를 보존한다.

## 7. 공통 embedder·runtime 경계

[현재 CMake](Nelyx/engine/CMakeLists.txt)와 [Windows host](Nelyx/engine/platform/windows/host.cpp)는 provider/runtime/UI 처리가 Windows 경로에 모여 있다. W9-01은 **Windows/Web에서 실제 공유할 lifecycle·mailbox·provider 계약에 필요한 최소 추출**로 제한한다. 후속 host 전용 adapter·모바일 RN helper나 전체 디렉터리 개편을 완료 조건으로 넣지 않는다. 아래 경로는 **목표 책임 배치**이며 새 경로를 미리 모두 만들라는 지시나 존재하는 파일에 대한 링크가 아니다.

```text
Nelyx/engine/
  core/                         # 기존 OS 독립 document/layout/interaction/scheduler
  include/ + bindings/          # 기존 versioned C ABI/wire
  platform/common/              # App runtime, owner mailboxes, host lifecycle
  platform/windows/             # Windows App SDK + HWND/TSF/UIA
  platform/linux/               # 2차 GTK4 + GDK/IM/AT-SPI
  platform/macos/               # 3차 AppKit + text input/NSAccessibility
  platform/android/             # 2차 중립 Kotlin/Java·JNI 입력/서비스·surface adapter
  platform/ios/                 # 3차 중립 Objective-C++·UIKit/UITextInput·Metal adapter
  render/skia-native/           # 공통 Picture/paragraph/image 준비·retained replay
  render/canvaskit-web/          # manifest/hash를 검증한 owned CanvasKit provider
```

Host 계약에는 surface/metrics·frame clock·input·text input·semantics·clipboard/services·wake·resource release·close를 포함한다. HWND/GObject/Objective-C 객체와 toolkit allocator를 공통 core/wire에 넣지 않는다. CPU Picture/paragraph 준비와 platform GPU presenter를 분리하고, OS별 font/ICU 결과를 공통 text corpus로 확인한다.

`packages/cupertino`·`packages/material` → TypeScript framework/engine-client → 공통 C ABI/wire → C++ engine/provider 순서로 의존한다. 위 engine 배치는 디자인 패키지를 옮길 목적지가 아니다. Engine은 두 패키지의 theme·Widget/State 구현을 포함하거나 다시 소유하지 않으며, adapter에도 이를 복제하지 않는다. 전송은 owned 값/명령/handle로 제한하고 JS 함수·Widget 객체를 Content/Render owner에서 직접 호출하지 않는다.

UI·App·Content·Render owner의 권한과 mailbox 상한, `DocumentAccepted`/`PreparationId`/publication·node/resource generation을 보존한다. 1차 Windows와 Web threaded는 **App/Content와 독립된 준비 scene 합성**을 요구한다. Web single-worker는 `contentIndependent=false`와 유한 분할/점유 후 회복을 구분한다. 후속 native host도 같은 독립 합성 계약을 따른다. UI의 실제 게시 adapter를 사용한다는 이유로 Content나 TS에서 매 frame raster하도록 바꾸지 않는다.

각 host 보고는 engine/host/backend·OS/ABI·VM/compiler·Skia·schema·source/asset identity·owner 배치·capability를 함께 제공한다. `native`라는 profile 하나에 서로 다른 OS binary를 덮어쓰지 않고 공급 manifest를 target별로 구별한다. 정확한 manifest version은 W9-00/01에서 정하고 기존 소비자의 불일치는 명확히 거부한다.

### 7.1 호스트 전환에서 보존할 공통 조건

아래는 새 기능을 늘리는 목록이 아니라 [work8의 상태·입력 계약](history/26/11/04/work8-1-summary.md#transactionabi준비-세대)을 새 host/provider에서도 유지하기 위한 회귀 조건이다. 수치 상한은 현재 [canonical protocol](Nelyx/engine/schema/protocol.json)을 사용하며 과거 예산을 새 공급에 그대로 복사하지 않는다.

| 경계             | 유지할 조건·연결 단계                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaction·준비 | W9-01/06에서 NACK의 원자 rollback·같은 ID/bytes 재시도·ID 재사용 거부·유실 ACK/결과 만료 후 resync를 유지. `DocumentAccepted`와 준비/게시 성공을 분리하고 승인 뒤 준비 실패·취소도 terminal·자원 회수까지 검사                                                                                     |
| 입력·진행 보장   | W9-01/07/10에서 **frame 시작 시 입력 watermark와 유한 quota**로 처리 범위를 고정. 전역 queue가 비기를 기다리지 않고 terminal/control 예약·view 공정성·lost-wake를 보존. 연속 입력과 연속 document 변경을 함께 주어 진행 중 호환 준비의 활성화 및 다음 최신 수요의 진행을 확인                      |
| Snapshot·자원    | Admission snapshot·frame/provider/GPU hold를 정확한 세대와 owner에 묶고 late 결과·취소·close에서 한 번 해제. Engine Wasm과 CanvasKit 사이에는 복사 bytes/각 module의 ID만 전달. Heap 성장 후 옛 typed-array view나 다른 module의 포인터·JSI/UI 객체를 보관하지 않음. W9-01/05/09/12/13에 적용      |
| 좌표·크기        | W9-05/07에서 constraints의 `finite/unbounded/expand`와 scroll extent의 `finite/estimated/unbounded`를 구별. 최종 layout/paint/hit-test·게시 bounds는 finite이며 NaN/임의 Infinity·overflow를 거부. Perspective/특이 transform의 projection·역변환 불가 시 hit/semantics 정책도 provider와 일치시킴 |
| Protocol·공급    | W9-05/07/11의 wire 확장 때 schema/필수 capability와 C++·TS·SDK·설치본 producer/consumer를 함께 갱신. 옛 schema·없는 필수 capability·잘못된 크기/자원/세대를 시작 또는 admission에서 거부하고 기존 scene과 ledger를 보존. 단순 source typecheck로 ABI 호환을 승인하지 않음                          |
| 디자인 구현 경계 | W9-06/08/13에서 두 TypeScript 패키지의 실제 State/theme/callback 실행과 C++ 공통 연산을 각각 확인. 패키지 내 native target·C++ Widget 복제·adapter의 대체 상태 기계로 원래 구현을 우회하지 않음                                                                                                    |

## 현재 구현·검증 — 2026-11-07 KST

이 절은 **2026-11-07 당시 기록**이다. W9B-00 기능·공급 근거는 [work9-b §3.2](work9-b.md#32-w9b-00-당시-공급검사실행-근거), 사용자 교정 뒤 구현은 [W9B-00-H](work9-b.md#34-w9b-00-h--host-단일화플랫폼-소스-이식-착수)에 보존한다. 현재 실행은 [work9-c](work9-c.md)를 따른다. 아래 두 host·자체 OS helper PASS를 App SDK 단일화·RNW 실제 이식 완료로 사용하지 않는다.

**IN_PROGRESS / Windows·Web 1차 PARTIAL.** 현재 공급은 **`175c55c60f565577f202650a44b127f67866e214b1ac24e736617e6996005114` / ABI 2·schema 2844160510 / App service 12·image service 2·HTTP header service 2**, manifest **349파일**(manifest 포함 350)이다. Native·두 Wasm·HWND/App SDK host와 Core·두 디자인·SDK를 빌드했다. App SDK **1.8.260508005**·C++/WinRT **2.0.250303.1**·Windows SDK **10.0.26100.0**·`/MD`·Graphite/Vulkan·Hermes를 유지한다.

**패키지 asset의 공통 소유권:** [PlatformAssetBundle/rootBundle](Nelyx/src/services/asset-bundle.ts)을 두 SDK App 모델의 [동일한 asset 소유자](Nelyx/sdk/src/runtime/engine-v2-assets.ts)에 연결했다. [DefaultAssetBundle](Nelyx/src/framework/widgets/default-asset-bundle.ts)은 ImageService 없이 App root를 쓰며 상위 override를 보존한다. 문자열·structured/binary cache, parser 실패 후 새 bytes 재시도·evict/clear·늦은 이전 App 결과 격리를 확인했다. CLI는 canonical binary/Web manifest와 bounded asset index를 생성하고 UTF-8·공백·Nx variant를 지원한다. 예약 manifest 이름과 파일/폴더 대소문자 충돌은 publish 전에 거부한다.

**서비스 준비·종료:** Web App bootstrap 계약 **1**을 요구하고 quota 응답·서비스 모듈·CanvasKit/폰트 다운로드까지 취소를 전달한다. 실패한 provider 요청의 나머지도 중단·정리한 뒤 staging credit을 반환한다. 중단할 수 없는 Wasm 초기화는 완료를 기다려 늦은 backend 전달을 차단하며, 확정 heap과 App **320 MiB** host 예약은 실제 worker 종료까지 유지한다. 두 모델·두 profile의 시작 단계 **28조건**, 정리 순서·heap credit 단위 **2개**를 통과했다. 이는 렌더 수요가 없는 lifecycle control이며 Native C++ 구현·성능 승인이 아니다.

**읽기 전 admit·실제 종료:** Native는 크기를 확인한 뒤 C++ 파일 IO·JSI copy를 수행한다. Web은 HEAD 또는 index로 크기/hash를 얻고 admit한 크기에 stream을 읽어 SHA-256을 검증한다. HEAD·전용 hash header가 없는 HTTP 경로도 검증했다. SDK IO 대기 **32개**, admit buffer **64개**, 누적 admit data **32 MiB**를 App quota 안에서 제한하며 입력당 **3 × size + 65536 bytes**를 확보한다. Metadata index는 별도 credit을 갖고 논리적 close 때 회수한다. 전달 ByteData는 호출자가 보유할 수 있어 credit을 Native runtime/Web worker 종료까지 유지한다. Font/asset buffer token은 공통 단조 발급기로 종류·owner 혼동을 막는다.

Native/Hermes의 실제 C++ asset **7읽기·52 bytes = SDK**, 논리적 close 뒤 **458908 bytes / buffer 7개** 유지·실제 runtime 종료 뒤 ledger **0**을 확인했다. 내장 image alias와 빈 파일·foreign/종류/중복 반환도 검증했다. 일반 SDK 두 모델 × 두 Web profile은 Original 각각 **65명령 = SDK·9읽기/113450 bytes**, data 각각 **17명령 = SDK·8읽기/810 bytes**다. 일반 HTTP의 index credit **3211264 bytes**는 close 때 회수하며, 시작/실행 중 취소·변조·초과 응답 거부 후 worker 종료·예약 **0**을 확인했다. 이 asset 장면은 App paragraph layout 수요가 없는 별도 control이며 C++ 파일 IO·Core 명령·실제 font decode를 구별한다.

**NetworkAssetBundle·HTTP 소유권:** [Canonical API](Nelyx/src/services/asset-bundle.ts)를 [공통 App transport](Nelyx/sdk/src/runtime/engine-v2-network.ts)에 연결했다. Base URL 문자열에 상대 key·query·fragment·절대 HTTP(S) key를 해석하고 HTTP 200만 성공시킨다. Bundle 자체 cache는 두지 않는다. [Native 비동기 WinHTTP](Nelyx/engine/platform/windows/app_http.hpp)와 Web fetch stream은 HTTP 전에 metadata/callback 복사용 **512 KiB**를 확보한다. 공통 IO 대기 **32개**, data **32 MiB**와 App quota를 유지하며 길이 미상·압축 응답은 할당 전에 **3 × capacity + 65536 bytes**를 늘리고 실제 길이로 줄인다. Native는 가용 bytes를 확인한 뒤 최대 **64 KiB**를 읽고 마지막 HANDLE_CLOSING callback·빌린 JSI 복사 뒤에 요청 credit을 반환한다. 비동기 transport 해제 실패는 staging을 quarantine하며 정상 drain으로 바꾸지 않는다. OS/browser 내부 network buffering은 소유 ledger의 측정 대상이 아니다.

**ImmutableBuffer·실제 소유권:** [Canonical API](Nelyx/src/ui/immutable-buffer.ts)와 `AssetBundle.loadBuffer()`를 연결했다. Native는 C++ SkData, Web은 CanvasKit 할당과 SDK byte upload/readback 복사를 사용한다. 입력 view는 Promise 반환 전 캡처하며 `fromAsset`·Native UTF-8 `fromFilePath`·길이·dispose를 제공한다. Public handle을 해제해도 engine holder와 진행 중인 읽기의 backing/credit은 마지막 참조까지 유지한다. 할당당 **2 × size + 65536 bytes**, live handle/할당 **64개**·data **32 MiB**·IO 대기 **32개**, 내부 chunk **256 KiB**를 제한한다. 불확정 해제·foreign/종류/중복·살아 있는 reader는 정상 drain으로 바꾸지 않는다. Buffer 전용 IO staging은 반환하며 caller ByteData의 realm credit과 구별한다.

**Source font/cohort 수명:** [FontLoader](Nelyx/src/services/font-loader.ts)·[공개 loadFontFromList](Nelyx/src/ui/fonts.ts)는 사용자 build 전에 준비한 같은 App 소유자를 쓴다. Optional family는 캡처한 bytes의 실제 C++ decoder로 읽는다. 기존 family/fallback·불변 recording·desired/ACK 대기 scene lease·View별 확정 알림과 relayout을 유지한다. 두 profile × 9상태는 각 **167명령 = SDK·Core layout 596·App 19/0 = SDK·Content 조판 21**, decode **64/53**·capture **24**·Source 알림 **12**·TS fallback **0**이다. Asset **9개/1013760 bytes**와 credit **3631104 bytes**는 actor 종료까지 유지한다. 세 독립 heap fault control은 **227명령 = SDK·Core layout 448·App 16/0 = SDK·Content 조판 22·capture 57·Source 알림 11·pixel 차이 0**이다.

**Native 선언 경계:** Data SDK entry의 browser 재수출이 Native에 DOM ambient type을 요구하던 문제를 [선언](Nelyx/sdk/src/runtime/engine-v2-browser.ts)에서 수정했다. 실제 TypeScript **7.0.2**로 두 모델 × 정상/시작 취소 × Windows/Web **8조합**을 strict 검사했다. Native는 ES2022·types=[]·skipLibCheck=false를 유지하고 Web은 정확한 Worker/MessagePort/Canvas/URL 타입을 보존한다. Runtime의 browser capability 요구와 실패 경계는 같다.

**ImageDescriptor/Codec·buffer 소비:** [Canonical descriptor](Nelyx/src/ui/image-descriptor.ts)·[codec 함수](Nelyx/src/ui/image-decoder.ts)를 두 App 모델의 App image service **2**과 기존 ImageService/ResourceRegistry에 연결했다. Native는 보유 SkData·명시적인 SkCodec decoder 목록, Web은 기존 소유 CanvasKit heap을 사용한다. Public buffer → descriptor → Codec → Image/clone/read의 독립 수명과 PNG·GIF frame duration/순서/반복·행 padding·RGBA/BGRA·resize·옵션 getter/target 실패·foreign/종류/quota·빌린 read 중 재진입을 검증했다. [실제 Native/Web](Nelyx/engine/tests/app-images.test.mjs)은 public 범위 각각 **descriptor 6·Codec 6·frame decode 10·pixel read 7회/60 bytes = SDK·TS fallback 0**이며 Native 패키지 파일 **1읽기/71 bytes**와 마지막 runtime 종료 뒤 ledger **0**이다. 일반 SDK 두 모델 × 두 profile도 같은 decode/read 집계·Core **32/17명령 = SDK**·최종 worker 종료/예약 **0**을 확인했다. Public 결과 **7개/credit 458932 bytes**는 caller ByteData를 위해 realm 종료까지 유지하고 descriptor/Codec/Image handle·불변 backing은 **0**이다. 이 검증은 decoder control이다. RawImage/RenderImage 표시는 아래의 Scene 검증으로 구별하며 float raw/target·PNG/straight-alpha readback은 미완료다.

**큰 encoded 이미지의 Scene 자원:** [청크 계약](Nelyx/runtime/engine-client/image-resource.ts)과 WidgetHost를 연결해 여러 이미지의 합계가 커져도 기존 packet **1 MiB**·resource **32 MiB** 안에서 **256 KiB**씩 전달한다. Core는 전체 upload 뒤 불변 backing을 게시하고, SDK는 upload의 첫 await 전 snapshot·동일 token 재전송·불확정 ACK·desired tree 교체·close 수명을 유지한다. Scene은 작은 inline 합계만 담고 나머지는 preparation/frame에 묶인 read로 Content에 전달한다. Producer 해제·같은 slot의 새 generation 뒤에도 이전 frame은 원래 bytes를 읽는다. [Core 수명 검사](Nelyx/engine/tests/image-resource-contracts.mjs)는 Native·두 Wasm **15조건**, [실제 표시 검사](Nelyx/engine/tests/image-resource-render-contracts.mjs)는 **1,229,560 bytes PNG 2장/3상태**를 통과했다. 일반·기존 설치 Web의 두 profile 각각 **33명령 = SDK·C++ layout 19·Content 이미지 기록 2·App geometry/TS fallback 0**, 실제 pixel 교체·worker 종료/예약 **0**이다. 별도 Native Content CPU control은 **측정 2·이미지 2·Picture 2**, producer backing 소멸 뒤에도 이전 Picture 픽셀을 유지하고 owner 종료 뒤 ledger **0**이다. Canonical RawImage/RenderImage는 별도 Scene snapshot 계약으로 연결했으며 Canvas는 미완료다.

**Canonical RawImage/RenderImage·Scene:** [App frame 소유자](Nelyx/sdk/src/runtime/engine-v2-images.ts)와 [Original bridge](Nelyx/runtime/engine-client/original.ts)를 연결했다. 같은 Image/clone은 불변 RGBA snapshot 한 개를 공유하며, 별도 Scene credit을 픽셀 복사 전에 확보한다. Public toByteData quota는 소비하지 않는다. Snapshot은 수락된 이전 트리·불확실한 upload 등 마지막 App 참조까지 유지하며 Core/Content/Picture는 각자의 자원 credit으로 픽셀을 보유한다. [C++ 배치](Nelyx/engine/core/scene/image.hpp)는 크기/scale·7가지 BoxFit·alignment·repeat·RTL 반전·nine-patch·박스 밖 그리기 범위를 계산한다. Native Skia/CanvasKit은 같은 배치에 opacity·tint/blend·색 반전·filter quality를 적용하며 Source render object를 TS layout에 attach하지 않는다. [Core 검사](Nelyx/engine/tests/image-style-contracts.mjs) **6조건**과 [Original 수명](Nelyx/engine/tests/original-image-contracts.mjs) **9조건**은 세 경로의 fit·타일 초과·오류 복구·known NACK 연속 교체·chunk ACK 유실 뒤 교체/close를 확인했다. [실제 일반/설치 SDK](Nelyx/engine/tests/raw-image-render-contracts.mjs)의 두 Web profile은 각각 **574명령 = SDK·C++ layout 376·이미지 배치 148·Content 이미지 기록 24·App geometry/TS fallback 0**이다. 12개 RawImage 배치의 프레임 2개/opacity 변경·호출자 Image/clone/codec 해제 뒤 픽셀·교체/제거를 확인했다. Snapshot **2개/524288 pixel bytes**, public readback **0**, 제거 뒤 frame/Scene credit **0**·최종 worker 종료/예약 **0**이다. Native CPU는 별도 **Raw 스타일 8개**와 마지막 Picture까지의 원본 backing 보유·최종 ledger **0**이다. 실제 Native/Web App control은 캡처 실패 credit 반환·동일 clone 공유·foreign registry/틀린 크기 거부·Source frame보다 긴 Scene 수명도 통과했다. Stream visibility·유한 반복 종료/복구·Canvas와 추가 형식 및 물리/성능 승인은 미완료다.

**ImageProvider·캐시·Core 시계:** [App decoder/IO](Nelyx/sdk/src/runtime/engine-v2-images.ts)를 Source ImageService·ImageProvider/ImageCache·Original Image Widget에 연결했다. Memory·Asset·Resize·Network와 Native FileImage가 같은 immutable buffer/descriptor 소유자를 사용하며 provider byte 캡처도 복사 전에 credit을 확보한다. [Core 시계](Nelyx/runtime/engine-client/app-image-clock.ts)는 실제 Core timestamp와 절대 deadline을 사용하고 frame/timer callback을 각각 **64개**로 제한한다. 새 state는 **744 bytes**, deadline 요청은 f64 초 단위이며 취소·동일 deadline ACK 재시도·숨김/복원은 [Native·두 Wasm 6조건](Nelyx/engine/tests/image-clock-contracts.mjs)으로 확인했다. [일반/기존 설치 Web](Nelyx/engine/tests/image-provider-render-contracts.mjs)은 두 profile 각각 **334명령 = SDK·C++ layout/image paint >0·Content 이미지 7·App geometry/TS fallback 0**이다. 실제 Memory/Asset/Network/resize 픽셀·동일 key 캐시의 동기 clone 공유·GIF 전환/TickerMode 정지·재개·404/손상 bytes 오류 대체·cache eviction·pending HTTP 중 close와 최종 worker 종료/예약 **0**을 확인했다. PNG **131155 bytes**의 중간 **65536 bytes** 진행률도 관찰했다. 제거 뒤 descriptor/Codec/frame/Scene credit은 **0**, public readback은 사용하지 않는다. [Native Hermes control](Nelyx/engine/tests/image-provider-native-contracts.mjs)은 **descriptor 8·Codec 7·decode 9·pixel read 6/48 bytes = SDK·TS fallback 0**, 실제 파일 **1읽기/71 bytes**·HTTP 요청 **7회**·최종 ledger **0**이다. Native의 이 control은 수동 App 시계이며 실제 Core deadline/일반 Web 표시와 구별한다. Native HTTP는 빈 key의 정확한 URL/query를 유지하고 같은 origin의 Authorization/Cookie는 보존하며 교차 origin에서는 제거한다. 기본 Original App은 사용자 build 전에 HTTP header service **2**를 요구하며 오래된 공급의 두 profile 시작 거부도 확인했다. Caller ByteData/readback credit은 realm까지 유지한다. Stream visibility·유한 반복 종료/복구·Canvas와 추가 형식 및 물리/성능 승인은 남는다.

Core **419/419**, 통합 **53/53**, Source·수명·편집기·캐시·Frame **108/108**, geometry **2/2·7/7**, 도구/API/supply **32/32**을 통과했다. 경계 **1012파일·551 facade·7914 edge·cycle 8/design 0**, lint·format **2006파일**·디자인 소유권·workspace/CLI/Metro 타입 검증을 통과했다. 전체 API는 원래 **4 package/834 subpath·hash 16개**를 보존한 **inputValid=true / compatible=false**다. 현재 **847 subpath/4629 occurrence**, compiler **7.0.2**, Core v2 symbols **195**이다. `loadBuffer` 추가 두 건은 원래 클래스의 모든 멤버를 고정 선언으로 대조한 뒤에도 **signatureChanged / structuralCompatibility=notApproved**로 남긴다. 원래 hash/분모를 바꾸지 않으며 기존 멤버 수정·삭제는 여전히 입력 실패다. 현재 동작 검사가 기존 구조적 타입 호환성을 승인하지 않는다.

기존 Windows/Web 설치본에서 각 Windows/Web target **847개** strict 입력·실제 compiler **7.0.2**·Root/PlatformAssetBundle·NetworkAssetBundle·ImmutableBuffer·ImageDescriptor/Codec·FontLoader/UI·App service **12** 타입·README FontLoader/assetByteLength/remoteAssetByteLength/firstImagePixels 예제·CLI build/verify를 통과했다. Core **687 module/2748 dist 파일**, SDK **123/492**, Material **259/1036**, Cupertino **64/256**, SDK native **63**·CLI **75**·Metro **34**·owned Web runtime **6**·Core/SDK EN/KO README의 exact set/hash/source-map 입력이 일치한다. 설치 Web 두 profile은 각각 **1067명령 = SDK·App 8/0 = SDK·Content 조판 17**, asset **4읽기/337923 bytes·credit 1275913 bytes**, buffer **13캡처/113208 bytes = SDK·asset buffer 읽기 2회/112643 bytes·최종 handle/credit 0**, network raw/buffer 각각 **1읽기/3 bytes·network credit 0**, font credit/queue **0**·실제 close 예약 **0/worker 종료**다. 세 기존 runner의 일반 check도 통과했다. Native 창/물리 검증과 구별한다.

**다음:** 이미지 stream visibility/복구·Canvas 연결·OS font 알림과 기존 구조적 타입 변경을 해결한다. 추가 text/선택·geometry·Canvas/Picture/custom hook·입력/서비스·가변 list·콘텐츠/복구와 W9-06/07/08/13/14도 남는다. TypeScript **7.0.2**와 변환/원래 inventory용 Microsoft 6 호환 API를 구별한다. 사용자 허용의 CanvasKit **초기 128 MiB / 최대 256 MiB**, App **320 MiB**, ledger **768 MiB / GPU 128 MiB**를 유지한다. Native UIA `E_UNEXPECTED`·물리 Esc 중단 경계를 재개하지 않았으며 두 성능 flag **false**·물리/display/scanout **notVerified**, 후속 플랫폼 **DEFERRED**다. [현재 증거와 다음 실행](work9-3.md#현재-구현검증과-잔여-작업)을 따른다.
