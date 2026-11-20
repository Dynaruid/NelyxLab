# Nelyx

[English](README.md) | **한국어**

Nelyx는 Flutter의 위젯과 렌더링 모델을 TypeScript로 구현한 SDK입니다. 공용 Widget·Element·RenderObject 트리에서 Material과 Cupertino 앱을 작성합니다. React DOM이 화면 요소를 관리하고 CanvasKit/Ganesh가 WebGL2로 그립니다. Vite로 빌드한 PWA는 브라우저에서 실행하거나 Tauri 앱에 내장할 수 있습니다.

## Testbed와 Demo 실행

Node.js 24.3 이상 24.x와 npm 11을 사용합니다. 새 checkout에서는 먼저 고정된 CanvasKit JS와 Wasm을 준비합니다. [CanvasKit 소스 빌드](Nelyx/skia/eng/source-build/README.md)

저장소 루트에서 PowerShell로 실행합니다.

```
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run prepare:sample -- web
npm.cmd ci --prefix sample/nelyx-testbed-app-2/web/runner --workspaces=false
npm.cmd run dev --workspace @nelyx/testbed-2
```

터미널에 표시된 개발 URL을 엽니다. 브라우저 설치와 배포에는 PWA를 빌드한 뒤 정적 결과를 제공합니다.

```
npm.cmd run build:pwa --workspace @nelyx/testbed-2
npm.cmd run run:pwa --workspace @nelyx/testbed-2 -- --base /demo/
```

기존 PWA를 Windows용으로 패키징합니다. 이 단계에는 Tauri CLI와 해당 OS 도구가 필요합니다.

```
npm.cmd run prepare:windows --workspace @nelyx/testbed-2
npm.cmd run pack:windows --workspace @nelyx/testbed-2
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

### Android에서 Demo 실행

Demo 러너와 Android 도구를 준비한 뒤 에뮬레이터를 시작하거나 휴대폰을 연결합니다. 저장소 루트에서 아래 PowerShell 명령을 실행하고 `--device`에 연결한 기기의 ADB 시리얼을 넣습니다. 갤럭시 같은 ARM64 휴대폰에서는 두 `--architecture` 값을 `arm64`로 바꿉니다. [Demo Android 준비 및 연결](sample/nelyx-demo-app/README.ko.md#android에서-실행)

```powershell
npm.cmd run prepare:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run build:android --workspace @nelyx/demo -- --architecture x64
npm.cmd run run:android --workspace @nelyx/demo -- --device emulator-5554
```

## 문서

| 경로 | 내용 |
| --- | --- |
| [Core](Nelyx/README.ko.md) | 위젯과 프레임워크 |
| [SDK](Nelyx/sdk/README.ko.md) | React DOM 화면·브라우저 서비스·자산 |
| [Skia](Nelyx/skia/README.ko.md) | CanvasKit 공급과 렌더링 |
| [CLI](Nelyx/sdk/tooling/cli/README.ko.md) | 생성·SDK 공급·Vite·Tauri 명령 |
| [Demo](sample/nelyx-demo-app/README.ko.md)와 [Testbed](sample/nelyx-testbed-app-2/README.ko.md) | 샘플 앱 |
| [플랫폼 검증](work3.md#7-최종-인수와-현재-상태) | 환경별 빌드와 실행 결과 |
| [작업 이력](history/README.md) | 이전 계획과 구현 기록 |

Nelyx 코드는 BSD 3-Clause를 사용합니다. 이식한 코드에는 각 원본의 라이선스가 적용됩니다. [라이선스](Nelyx/LICENSE.md) · [Skia 고지](Nelyx/skia/THIRD_PARTY_NOTICES.md)
