# Nelyx

[English](README.md) | **한국어**

Nelyx는 **Flutter의 위젯·렌더링 모델을 TypeScript로 구현하는 실험적 UI SDK**입니다. Widget 트리, 제약 기반 레이아웃과 Skia 렌더링으로 데스크톱·모바일·웹에서 UI를 공유합니다.

Nelyx가 위젯, 상태, 레이아웃, 페인트와 hit test를 관리하고, 플랫폼 runner가 창이나 브라우저 canvas, 입력, 접근성과 OS 서비스를 연결합니다.

[시작하기](#시작하기) · [플랫폼별 구현](#플랫폼별-구현) · [문서](#문서)

## 주요 특징

- **TypeScript UI 공유** — 공통 `src/`에서 위젯을 조합하고 앱 로직을 작성합니다.
- **Flutter 방식의 프레임워크** — Widget 구성, Element의 지속 상태, RenderObject의 레이아웃·페인트로 책임을 나눕니다.
- **Skia 렌더링** — 네이티브에서는 Graphite를, 브라우저에서는 CanvasKit/Ganesh와 WebGL2를 사용합니다.
- **앱 서비스** — 텍스트 편집, 제스처, 내비게이션, 자산과 플랫폼 메시징을 제공합니다.
- **디자인 패키지** — 공통 프레임워크 위에 Material 3·Cupertino 컴포넌트를 제공합니다.
- **플랫폼 도구** — CLI, 앱 템플릿과 대상별 독립 runner를 제공합니다.

## 시작하기

**Node.js 24.x 중 24.3 이상**, npm과 **Python 3**가 필요합니다. Web 샘플에는 WebGL2 브라우저와 대응하는 Nelyx CanvasKit 런타임도 필요합니다. 새 checkout에서는 [소스 빌드 가이드](Nelyx/skia/eng/source-build/README.md#vendor-build-recipes)에 따라 런타임을 먼저 준비하세요.

PowerShell에서 실행합니다.

```powershell
git clone https://github.com/Dynaruid/NelyxLab.git
cd NelyxLab
npm ci
npm run build:sdk
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
npm run prepare:sample -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts --workspaces=false
npm run dev:web --workspace @nelyx/testbed-2
```

`http://127.0.0.1:8081/`에 접속합니다. 서버는 Ctrl+C로 종료합니다. 런타임 검사는 준비된 CanvasKit 파일을 확인합니다. 파일이 없거나 manifest와 다르면 소스 빌드 가이드를 따라 준비한 뒤 샘플을 공급하세요.

정적 Web 빌드는 다음 명령을 사용합니다.

```powershell
npm run build:web --workspace @nelyx/testbed-2
```

Windows·Android 준비와 실행은 [Testbed 가이드](sample/nelyx-testbed-app-2/README.ko.md), 로컬 패키지 archive를 이용한 별도 앱 생성은 [CLI 가이드](Nelyx/sdk/tooling/cli/README.ko.md)를 참고하세요.

## 플랫폼별 구현

| 대상 | 기본 호스트 | 렌더러 |
| --- | --- | --- |
| Windows | React Native Windows / Hermes | Graphite / Vulkan |
| Android | React Native / Hermes | Graphite / Dawn / Vulkan |
| iOS | React Native / UIKit | Graphite / Metal |
| macOS | React Native macOS / AppKit | Graphite / Metal |
| Linux | React Native Linux / GTK4 / X11 | Graphite / Vulkan |
| Web | React DOM / React Native Web | CanvasKit / Ganesh / WebGL2 |

네이티브 대상에는 해당 플랫폼 도구와 대응하는 렌더러 입력이 필요합니다. Windows에서는 V8·JSC 엔진을 직접 선택하거나 실험적인 직접 Hermes 호스트를 사용할 수도 있습니다. 준비 방법과 실행 모드는 [샘플](sample/nelyx-testbed-app-2/README.ko.md)·[Skia](Nelyx/skia/README.ko.md) 가이드에 있습니다.

## 동작 구조

| 계층 | 책임 |
| --- | --- |
| Widget | UI 구성 기술 |
| Element | 식별, 상태, 의존성과 트리 수명 유지 |
| RenderObject | 레이아웃, 페인트와 hit test 계산 |
| Core | UI 트리, 프레임과 자원 계약 조율 |
| SDK | 플랫폼 입력, 자산, 서비스와 호스트 수명 연결 |
| Skia | 프레임 렌더링과 네이티브·브라우저 그래픽 자원 관리 |

공통 앱은 `src/index.ts`에서 `main()`을 export하고, 플랫폼 runner가 앱을 등록해 렌더링 표면을 제공합니다. `@nelyx/core/framework/widgets/basic`, `@nelyx/material/widgets`, `@nelyx/sdk/platforms/web/surface`처럼 패키지 하위 경로에서 API를 import합니다. [Widget 예제](Nelyx/README.ko.md#widget-앱)를 참고하세요.

## 문서

| 가이드 | 내용 |
| --- | --- |
| [Core](Nelyx/README.ko.md) | Widget 앱, 모듈 import, 상태와 렌더링 |
| [SDK](Nelyx/sdk/README.ko.md) | 플랫폼 API, 앱 설정, 자산과 수명 |
| [Material](packages/material/README.md) / [Cupertino](packages/cupertino/README.md) | 디자인 컴포넌트, 테마와 아이콘 자산 |
| [Testbed](sample/nelyx-testbed-app-2/README.ko.md) | 컴포넌트 갤러리와 Web·Windows·Android 실행 |
| [CLI](Nelyx/sdk/tooling/cli/README.ko.md) | 앱 생성, 패키지 공급, 빌드와 실행 |
| [Metro](Nelyx/sdk/tooling/metro/README.ko.md) | Runner 설정, 자산과 번들 |
| [Skia](Nelyx/skia/README.ko.md) | 렌더러 패키지와 네이티브 입력 |
| [개발 이력](history/) | 보관된 설계 결정과 작업 요약 |

## 프로젝트 상태

Nelyx는 개발 중이며 API가 변경될 수 있습니다. Flutter API의 일부를 구현하고 있고 Material·Cupertino의 지원 범위도 아직 불완전합니다. Testbed는 사용할 수 없는 데모를 준비 중으로 표시합니다.

플랫폼별 준비 수준에는 차이가 있습니다. Apple 네이티브 빌드·실행·서명과 Linux GTK·GPU 실행은 미검증입니다. Windows full reload와 전체 그래픽 복구도 해결되지 않았습니다. 물리 입력, IME, 스크린 리더, 성능과 제품 배포에는 추가 검증이 필요합니다. Runner 제공이 모든 대상의 제품 지원을 뜻하지는 않습니다.

## 저장소 구성

| 경로 | 내용 |
| --- | --- |
| [`Nelyx/src/`](Nelyx/src/) | 플랫폼 독립 Core 프레임워크 |
| [`Nelyx/sdk/`](Nelyx/sdk/) | 플랫폼 SDK와 앱 호스트 |
| [`Nelyx/skia/`](Nelyx/skia/) | 공통 렌더러와 네이티브·Web 어댑터 |
| [`packages/`](packages/) | Material·Cupertino 디자인 패키지 |
| [`Nelyx/sdk/tooling/`](Nelyx/sdk/tooling/) | CLI, Metro와 앱 템플릿 |
| [`sample/nelyx-testbed-app-2/`](sample/nelyx-testbed-app-2/) | 공통 샘플과 플랫폼 runner |
| [`Nelyx/eng/`](Nelyx/eng/) | Workspace 빌드·유지보수 도구 |

## 라이선스

Nelyx 작성 코드는 [BSD 3-Clause License](Nelyx/LICENSE.md)를 따릅니다. 가져온 코드의 라이선스와 고지는 [라이선스 목록](Nelyx/licenses/)과 [Skia 고지](Nelyx/skia/THIRD_PARTY_NOTICES.md)에 유지합니다.
