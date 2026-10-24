# Nelyx

[English](README.md) | **한국어**

프로젝트는 `@nelyx/*` 패키지, `nelyx` CLI·`package.json` 설정 키, `NELYX_*` 환경변수를 사용합니다. SDK 소스는 `Nelyx/`, 샘플은 `sample/nelyx-testbed-app-2/`, 생성되는 앱 공급 파일은 `.nelyx/`에 있습니다. SDK를 빌드하고 각 러너를 prepare한 뒤 패키지를 설치하세요.

이전 바이너리와의 호환은 제공하지 않습니다. Web 샘플을 prepare·빌드하기 전에 [Nelyx CanvasKit 런타임을 새로 빌드해 공급](Nelyx/skia/eng/source-build/README.md#vendor-build-recipes)해야 합니다. 새 바이너리를 공급하기 전까지 런타임 manifest는 `requires-build` 상태입니다.

현재 계획은 [work13.md](work13.md)이며 실행은 RUNNING, 제품은 PARTIAL입니다. Material/Cupertino는 `@nelyx/material/widgets`·`@nelyx/cupertino/widgets`에서 직접 소비합니다. [Core 패키지 import 안내](Nelyx/README.ko.md#디자인-패키지-import)를 참고하세요. 현재 상태는 루트 작업 문서에만 짧게 관리하며 삭제한 실행 기록을 재개 조건으로 요구하지 않습니다.

현재 배치에는 `SpringDescription` 전체 클래스와 추적된 수동 simulation 선언의 합성이 포함됩니다. `PhysicalShape`는 실제 경로 clip과 그림자를 사용합니다. TextStyle의 Paint·baseline·패키지 글꼴 이름은 paragraph 경로에 연결됩니다. 공급한 archive는 빌드 전에 설치해야 하며, runner 검사는 같은 버전의 이전 로컬 archive가 남아 있어도 거절합니다. 현재 원본·패키지·플랫폼 증거는 work8에서 구분해 기록합니다.

### Flutter의 위젯·렌더링 시스템을 TypeScript로

Nelyx는 **Flutter의 위젯과 렌더링 시스템을 TypeScript 환경으로 옮겨**, 데스크톱·모바일·웹에서 UI를 공유하는 것을 주요 목표로 하는 실험적인 UI SDK 프로젝트입니다.

Widget이 UI 구성을, Element가 상태와 트리 수명을, RenderObject가 레이아웃·페인트·hit test를 담당하는 프레임워크를 지향합니다. Nelyx가 UI 트리와 build → layout → paint 흐름을 관리하고, 그 결과를 Skia로 그리는 구조를 TypeScript로 구현하려 합니다.

현재 선택한 Widget·Element·RenderBox 트리, host tick scheduler, constraints·text·gesture, 고정 extent lazy list, 여러 native editor session과 navigation을 구현했습니다. 샘플은 공통 Widget 트리로 화면을 구성합니다. 실제 Chrome WebGL2·Windows native UI·Android emulator 조작을 범위별로 확인했으며, 최신 수락 범위와 물리 입력 등의 미확인 항목은 [work5.md](work5.md)에 기록합니다.

[시작하기](#시작하기) · [플랫폼별 구현](#플랫폼별-구현) · [문서](#문서)

> [!WARNING]
> Nelyx는 개발 중인 실험적 프로젝트입니다. API와 프로젝트 구조가 변경될 수 있으며, 플랫폼마다 검증 범위가 다릅니다.

## 주요 특징

- **Flutter 방식의 위젯·렌더링 구조** — keyed State와 constraints·layout·paint·hit test를 TypeScript로 관리합니다.
- **TypeScript 앱 코드 공유** — 앱 상태, 장면 구성과 `main()` 진입점을 `src/`에 둡니다.
- **플랫폼 SDK API** — 명시적인 플랫폼 모듈로 애플리케이션, 렌더링 표면, 입력과 자산을 연결합니다.
- **Skia 렌더링** — 네이티브 대상은 Graphite를, 브라우저는 CanvasKit의 Ganesh/WebGL2를 사용합니다.
- **명시적인 자원 수명 관리** — 프레임 제출, GPU 작업 완료, 자산과 호스트 종료를 연결합니다.
- **독립적인 플랫폼 runner** — 각 대상이 React Native 또는 브라우저 의존성, Metro 설정과 네이티브 프로젝트를 관리합니다.
- **CLI와 템플릿** — 앱 생성과 대상별 준비·빌드·실행·개발·패키징 명령을 제공합니다.

## 플랫폼별 구현

다음 표는 현재 runner 구성을 나타내며, 플랫폼별 준비 수준에는 차이가 있습니다.

| 플랫폼 | 호스트 | 렌더링 구성 | 현재 확인 범위 |
| --- | --- | --- | --- |
| Windows | React Native Windows / Hermes | Graphite / 네이티브 Vulkan | x64 Release 샘플 실행 확인, full reload 문제 미해결 |
| Android | React Native / Hermes | Graphite / Dawn / Vulkan | x86_64 Release 에뮬레이터 실행 확인, 최신 ARM64와 물리 기기 수락 미완료 |
| iOS | React Native / UIKit | Graphite / Metal | 소스 연동 범위, 네이티브 빌드·실행·서명 미검증 |
| macOS | React Native macOS / AppKit | Graphite / Metal | 소스 연동 범위, 네이티브 빌드·실행·서명 미검증 |
| Linux | React Native Linux / GTK4 / X11 | Graphite / 네이티브 Vulkan | 공급 패키지·binding 컴파일 확인, GTK 호스트·GPU 실행 미검증 |
| Web | React DOM / React Native Web | CanvasKit / Ganesh / WebGL2 | 빌드·headless 상호작용 확인, 물리 입력·접근성 수락 미완료 |

네이티브 빌드에는 해당 플랫폼 도구와 버전이 고정된 렌더러 입력이 필요합니다. [샘플 가이드](sample/nelyx-testbed-app-2/README.ko.md)와 [Skia 가이드](Nelyx/skia/README.ko.md)를 참고하세요.

## 시작하기

Web 샘플에는 **Node.js 24.x 중 24.3 이상**, npm, 소스 트리 SDK 준비용 **Python 3**와 WebGL2 브라우저가 필요합니다. 최초 SDK 빌드에서 고정된 입력을 다운로드할 수 있습니다. 네이티브 대상의 추가 도구는 샘플 가이드에 정리했습니다.

PowerShell에서 저장소 루트를 기준으로 실행합니다.

```powershell
git clone https://github.com/Dynaruid/NelyxLab.git
cd NelyxLab
npm ci
npm run build:sdk
npm run prepare:sample -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts
npm --prefix sample/nelyx-testbed-app-2/web/runner run dev
```

`http://127.0.0.1:8081/`에 접속합니다. 서버는 Ctrl+C로 종료합니다. `prepare:sample`은 현재 workspace 패키지를 압축해 앱의 `.nelyx/supply/web/`로 복사하고 runner lockfile을 갱신합니다. 다음 `npm install`이 해당 runner의 의존성과 lockfile을 준비합니다.

정적 빌드는 `npm --prefix sample/nelyx-testbed-app-2/web/runner run build`로 수행합니다. 다른 플랫폼 실행과 저장소 밖 앱 생성은 [샘플](sample/nelyx-testbed-app-2/README.ko.md)·[CLI](Nelyx/sdk/tooling/cli/README.ko.md) 가이드를 참고하세요.

## 동작 구조

프레임워크는 Flutter처럼 UI 구성, 트리의 지속 상태와 렌더링 책임을 나누는 방향입니다.

| 계층 | 책임 |
| --- | --- |
| Widget | UI 구성을 선언적으로 기술 |
| Element | 위젯 식별·상태·갱신과 트리 수명 유지 |
| RenderObject | 제약 기반 레이아웃, 페인트와 hit test |
| 프레임 파이프라인 | build·layout·paint와 렌더러 제출 흐름 조율 |

상태 변경에 따라 영향을 받는 UI 분기를 갱신하고 Skia backend에 전달할 프레임을 만드는 것이 목표입니다. 현재 구현은 이 파이프라인을 위한 다음 기반을 제공합니다.

```text
공통 TypeScript 앱: src/index.ts → main()
                    ↓
@nelyx/core: UI·프레임·자원·수명 계약
                    ↓
@nelyx/sdk: 플랫폼 앱·입력·자산·호스트 수명 연결
                    ↓
플랫폼 runner + @nelyx/skia-rn 또는 @nelyx/skia-web
                    ↓
네이티브 GPU 렌더링 표면 또는 브라우저 canvas
```

샘플의 카운터·editor·목록·상세·dialog는 공통 Widget 트리를 사용합니다. React Native와 React DOM / React Native Web은 surface와 native 편집·접근성 컨트롤을, Nelyx는 위젯 트리와 layout을 소유합니다. `@nelyx/core/framework/widgets/basic`, `@nelyx/core/framework/widgets/root`, `@nelyx/sdk/platforms/web/surface`처럼 직접 하위 경로에서 import합니다. [core 예제](Nelyx/README.md#widget-applications)를 참고하세요.

## 문서

| 가이드 | 내용 |
| --- | --- |
| [Core](Nelyx/README.ko.md) | 플랫폼 독립 계약과 패키지 빌드 |
| [SDK](Nelyx/sdk/README.ko.md) | 플랫폼 API, 호스트 책임, 설정과 provider |
| [샘플 앱](sample/nelyx-testbed-app-2/README.ko.md) | 공통 앱, 플랫폼 준비·실행 명령과 문제 해결 |
| [CLI와 템플릿](Nelyx/sdk/tooling/cli/README.ko.md) | 앱 생성, 패키지 공급과 대상별 명령 |
| [Metro](Nelyx/sdk/tooling/metro/README.ko.md) | runner 설정, 자산, bundle과 개발 서버 |
| [Skia](Nelyx/skia/README.ko.md) | 네이티브 입력, 렌더러 패키지와 소스 빌드 |

## 프로젝트 상태

Nelyx는 실험적 프로젝트입니다. 선정한 공통 프레임워크 API를 구현했으며, 고정 extent 목록·bounded text·affine transform·native editor overlay 범위입니다. GlobalKey reparent, intrinsic/baseline flex, 전체 디자인 위젯 parity, restoration/deep link와 상태 보존 reassemble은 후속 범위입니다. Android에는 native composing/selection bridge가 있으며 물리 IME·접근성 수락과 stock RN/DOM의 관측 제약은 별도로 남아 있습니다. Provider qualification은 `notVerified`이며 compiler·동작 assertion만으로 플랫폼 전체 지원을 입증하지 않습니다.

Windows 기본 구성은 stock RNW 0.83.2 Core입니다. private unload 변경은 [manifest](Nelyx/upstream/react-native-windows-private-unload.json)와 patch로 보존하며 기본 제품에 적용하지 않습니다. stock Core full reload와 전체 SDK/GPU 실패 정리·loss/recovery는 미해결입니다. 물리 입력, 한국어 IME, 스크린 리더, scanout/FPS, 서명과 새 환경에서의 설치·실행 수락은 별도로 확인해야 합니다.

## 저장소 구성

| 경로 | 내용 |
| --- | --- |
| [`Nelyx/src/`](Nelyx/src/) | 플랫폼 독립 core |
| [`Nelyx/sdk/`](Nelyx/sdk/) | SDK, 플랫폼 API, provider와 네이티브 앱 호스트 |
| [`Nelyx/skia/`](Nelyx/skia/) | 공통 네이티브 렌더러, RN/Web 패키지와 공급 입력 |
| [`Nelyx/sdk/tooling/`](Nelyx/sdk/tooling/) | CLI, Metro 도구와 앱 템플릿 |
| [`Nelyx/eng/`](Nelyx/eng/) | 패키지 빌드, provider 생성과 샘플·템플릿 준비 |
| [`Nelyx/upstream/`](Nelyx/upstream/) | upstream 버전 고정 정보, patch와 런타임 overlay |
| [`sample/nelyx-testbed-app-2/`](sample/nelyx-testbed-app-2/) | 공통 샘플과 독립 플랫폼 runner |

## 라이선스

Nelyx 작성 코드는 [BSD 3-Clause 라이선스](Nelyx/LICENSE.md)를 따릅니다. 수입 코드의 라이선스와 고지는 유지합니다. [라이선스 목록](Nelyx/licenses/)과 [Skia 서드파티 고지](Nelyx/skia/THIRD_PARTY_NOTICES.md)를 참고하세요.
