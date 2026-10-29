# Nelyx Skia

[English](README.md) | **한국어**

Nelyx의 렌더링 계층입니다. 공통 네이티브 그래픽·텍스트, React Native surface 어댑터와 브라우저 CanvasKit 렌더링을 제공합니다. [SDK](../sdk/README.ko.md)가 렌더러를 앱 호스트·입력에 연결합니다.

## 렌더러 구성

| 경로 | 용도 |
| --- | --- |
| [native/](native/) | 공통 렌더러·GPU·텍스트 구현 |
| [packages/native/](packages/native/README.md) | 공통 네이티브 렌더러, 자원, 문단과 JSI binding |
| [packages/rn/](packages/rn/README.md) | React Native 컴포넌트, surface와 어댑터 |
| [packages/web/](packages/web/README.md) | CanvasKit/Ganesh WebGL2 렌더러와 텍스트 |
| [vendor/](vendor/) | 고정된 네이티브 입력 lock과 공급 설정 |
| [eng/source-build/](eng/source-build/README.md) | Vendor 소스 준비와 빌드 recipe |

Android·Apple은 고정된 m154/154.1.0 공급을, Windows·Linux는 대응하는 m153 Vulkan SDK와 모듈 소스를 사용합니다. 각 대상의 ABI, 소스 목록과 런타임 입력이 호환되어야 합니다.

## 패키지 빌드

저장소 루트에서 `npm ci` 후 실행합니다.

```powershell
npm run build:skia
```

생성 네이티브 소스를 준비하고 native·RN·Web TypeScript 패키지를 빌드합니다. 네이티브 바이너리는 대상별로 별도 빌드합니다. 전체 SDK 패키지는 `npm run build:sdk`를 사용합니다.

준비에는 Python 3가 필요하며 최초 실행에서 고정된 SDK header를 다운로드할 수 있습니다.

## Web 런타임

Web은 소스로 빌드한 Nelyx CanvasKit 런타임을 사용합니다. [Vendor 빌드 recipe](eng/source-build/README.md#vendor-build-recipes)에 따라 출력을 공급하고 Web 앱 준비 전에 검사합니다.

```powershell
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
```

패키지 manifest가 필요한 파일을 식별합니다. 런타임 bytes가 없거나 일치하지 않으면 명시적인 준비 작업이 필요합니다.

## Windows 네이티브 입력

Python, Windows C++ toolchain과 [windows-rn-supplier.lock.json](vendor/windows-rn-supplier.lock.json)의 입력을 사용합니다. Binding에는 RNW 0.83.2 / JSI21, x64 Release와 MD runtime이 필요합니다. 재사용할 바이너리 공급 위치는 `vendor/inputs/windows-x64/`입니다.

[샘플 가이드](../../sample/nelyx-testbed-app-2/README.ko.md#windows-준비)에 따라 Windows runner를 설치한 뒤 저장소 루트에서 실행합니다.

```powershell
node Nelyx/skia/eng/prepare-native.mjs
python Nelyx/skia/eng/build-windows-rn.py --runner sample/nelyx-testbed-app-2/windows/runner --supplier Nelyx/skia/vendor/inputs/windows-x64 --output .nelyx/windows-rnw-native
```

현재 출력 하나를 유지하고 같은 빌드를 갱신할 때는 `--resume`을 추가합니다. 출력의 `<output>/supplier/inputs.json`을 설치된 runner CLI에 전달합니다.

```text
nelyx prepare --app <app> --target windows --native-inputs <inputs.json>
```

기준 C++·JSI 소스가 바뀌면 소스 준비·공급 파일 빌드를 반복하고 새 manifest로 앱을 준비하세요. 기본값은 stock RNW Core입니다.

Windows의 Graphite 캐시 예산은 physical backing의 픽셀당 48 bytes로 계산하고 96–192MiB 범위로 제한합니다. MSAA attachment와 offscreen/layer 리소스를 함께 보존해 스크롤 중 큰 scratch surface의 반복 할당을 줄입니다. 별도의 allocator 256MiB 상한과 backing-size 변경 시 정리는 유지합니다. native `gallery-scroll` 진단에 `NELYX_ANIMATION_NATIVE_TRACE=1`과 `NELYX_ANIMATION_NATIVE_CORE_TRACE=1`을 사용하면 warm 상태의 scratch 재사용을 검사할 수 있습니다. 이 검사는 물리 트랙패드나 표시 성능 수락을 증명하지 않습니다.

## Linux 네이티브 입력

[linux-graphite-probe.lock.json](vendor/linux-graphite-probe.lock.json)의 SDK와 대응하는 RNL/RN 0.81.6 소스를 사용합니다. [prepare-rn-modules.py](eng/source-build/prepare-rn-modules.py)로 모듈을 준비한 뒤 재배치 가능한 공급 파일을 만듭니다.

```text
python Nelyx/skia/eng/prepare-linux-inputs.py --cache <SDK-cache> --modules <prepared-modules> --output <new-supplier>
```

Recipe는 [native/vulkan/CMakeLists.txt](packages/rn/native/vulkan/CMakeLists.txt)·[native/linux/CMakeLists.txt](packages/rn/native/linux/CMakeLists.txt)에 있습니다. RNL archive는 [Linux CLI 공급](../sdk/tooling/cli/README.ko.md#linux-공급)을 참고하세요. 이름의 `probe`는 고정된 입력 profile 식별자입니다.

## 호환성과 자원

대응하는 Core·SDK·렌더러 패키지를 함께 설치합니다. 네이티브 소스를 바꾸면 공급 파일도 재빌드해야 하며, 런타임 연결 시 호환되지 않는 binding을 거절합니다.

Runtime shader는 캡처된 SkSL과 프레임별 uniform 값을 사용합니다. 컴파일된 프로그램은 렌더러의 cache owner가 소유하고 종료·context 수명에 따라 해제합니다. 프레임, recording과 GPU 제출은 각각의 자원 lease를 유지합니다.

플랫폼 준비 수준과 그래픽 복구 제약은 [프로젝트 가이드](../../README.ko.md#프로젝트-상태)에 있습니다.

## 라이선스와 출처

소스 pin과 고지는 [upstream.json](upstream.json), [upstream/](upstream/)과 [vendor/](vendor/)에 기록합니다. Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. 가져온 코드의 [서드파티 고지](THIRD_PARTY_NOTICES.md)·[라이선스](licenses/)에는 React Native Skia의 MIT 라이선스도 유지합니다.
