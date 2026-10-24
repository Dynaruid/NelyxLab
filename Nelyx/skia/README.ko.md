# Nelyx Skia

[English](README.md) | **한국어**

Nelyx 렌더러 구현과 버전이 고정된 네이티브 공급 구성입니다. [SDK](../sdk/README.ko.md)가 앱 호스트를, Skia가 GPU device, recording, 텍스트와 렌더링 표면을 관리합니다.

## 렌더러 구성

| 경로 | 용도 |
| --- | --- |
| [`native/`](native/) | 공통 렌더러·GPU·텍스트 구현 |
| [`packages/rn/`](packages/rn/README.md) | React Native JSI·component·surface와 Graphite 어댑터 |
| [`packages/web/`](packages/web/README.md) | CanvasKit/Ganesh WebGL2 렌더러와 텍스트 |
| [`vendor/`](vendor/) | 정확한 네이티브 입력 lock과 명시적으로 공급한 binary |
| [`eng/source-build/`](eng/source-build/README.md) | 버전 고정 소스 준비와 빌드 recipe |

Android/Apple은 고정된 m154/154.1.0 공급을, Windows/Linux는 일치하는 m153 네이티브 Vulkan SDK와 module 보충 소스를 사용합니다. 대상별 입력이므로 다른 버전으로 대체하거나 ABI·소스 목록이 다른 binary를 재사용하지 않습니다.

## 패키지 빌드

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run build:skia
```

이 명령은 생성 네이티브 소스를 준비하고 RN/Web TypeScript 패키지를 빌드합니다. 모든 대상의 네이티브 binary를 빌드하지는 않습니다. 전체 SDK 패키지 구성은 `npm run build:sdk`를 사용합니다.

소스 준비에는 Python 3가 필요하며 최초 실행에서 버전이 고정된 SDK header를 다운로드할 수 있습니다.

## Windows 네이티브 입력

Python, Windows C++ toolchain과 [`windows-rn-supplier.lock.json`](vendor/windows-rn-supplier.lock.json)에 일치하는 입력을 준비합니다. Binding에는 RNW 0.83.2 / JSI21, x64 Release와 MD runtime이 필요합니다. 필수 재사용 binary 공급 위치는 `vendor/inputs/windows-x64/`입니다.

저장소 루트에서 실행합니다.

```powershell
python Nelyx/skia/eng/prepare-artifacts.py --profile windows-x64-graphite-text-probe
python Nelyx/skia/eng/build-windows-rn.py --runner sample/nelyx-testbed-app-2/windows/runner --supplier Nelyx/skia/vendor/inputs/windows-x64 --output Nelyx/.cache/native/windows/new-build
```

먼저 [샘플 가이드](../../sample/nelyx-testbed-app-2/README.ko.md#windows)에 따라 Windows runner를 설치합니다. 새 출력 디렉터리를 사용합니다. 네이티브 빌드가 생성한 `<output>/supplier/inputs.json`을 runner에 설치된 CLI에 전달합니다.

```text
nelyx prepare --app <app> --target windows --native-inputs <inputs.json>
```

기본 구성은 stock RNW Core입니다. 보존한 private unload patch는 자동 채택하지 않습니다. [프로젝트 상태](../../README.ko.md#프로젝트-상태)를 참고하세요.

## Linux 네이티브 입력

[`linux-graphite-probe.lock.json`](vendor/linux-graphite-probe.lock.json)의 정확한 x86_64 SDK와 설치된 RNL/RN 0.81.6의 일치하는 소스를 사용합니다. [`prepare-rn-modules.py`](eng/source-build/prepare-rn-modules.py)로 module 입력을 준비한 뒤 재배치 가능한 공급물을 생성합니다.

```text
python Nelyx/skia/eng/prepare-linux-inputs.py --cache <SDK-cache> --modules <prepared-modules> --output <new-supplier>
```

Compile recipe는 [`native/vulkan/CMakeLists.txt`](packages/rn/native/vulkan/CMakeLists.txt)와 [`native/linux/CMakeLists.txt`](packages/rn/native/linux/CMakeLists.txt)에 있습니다. RNL archive 준비는 [CLI 가이드](../sdk/tooling/cli/README.ko.md#linux-공급)에 있습니다.

기존 `*-probe` 이름은 고정된 SDK profile 식별자이며 별도 probe target은 없습니다. Linux GPU 실행은 미검증입니다.

## 검증과 출처

소스 빌드, binary·소스 대응과 플랫폼 qualification은 각각 구분합니다. Apple 네이티브 빌드·실행·Metal·서명과 전체 플랫폼 qualification은 미검증입니다.

출처는 [`upstream.json`](upstream.json), [`upstream/`](upstream/)과 [`vendor/`](vendor/)에 기록합니다. Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 수입 코드의 [고지](THIRD_PARTY_NOTICES.md)와 [라이선스](licenses/)에는 RN Skia의 MIT 라이선스도 유지합니다.
