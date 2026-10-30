# Nelyx CLI

[English](README.md) | **한국어**

`@nelyx/cli`는 Nelyx 앱 생성, 패키지 공급, 대상별 준비·빌드·개발·실행·패키징을 담당합니다. Node.js **>=24.3.0 <25**와 npm을 사용합니다.

저장소 샘플은 [Testbed 가이드](../../../../sample/nelyx-testbed-app-2/README.ko.md)를 따르세요.

## 앱 생성

`nelyx` 명령과 호환되는 로컬 패키지 archive를 준비한 뒤 실행합니다.

```text
nelyx create MyApp --name MyApp --target web --packages <archive-directory>
npm --prefix MyApp/web/runner install --workspaces=false
npm --prefix MyApp/web/runner run dev
```

`http://127.0.0.1:8081/`에 접속하고 Ctrl+C로 서버를 종료합니다. 첫 설치에서 runner lockfile을 생성합니다.

대상 디렉터리는 비어 있어야 합니다. 앱 이름은 대문자로 시작하고 영문자·숫자를 사용합니다. `--target`으로 `web`·`windows`·`android`·`ios`·`macos`·`linux`를 선택합니다. 디자인 패키지는 `--designs none`·`material`·`cupertino`·`material,cupertino`로 지정합니다.

[시작 템플릿](templates/nelyx-app/README.ko.md)이 공통 앱과 플랫폼 runner를 제공합니다. 루트 `package.json`의 `nelyx`에서 설정하며, 자세한 내용은 [SDK 가이드](../../README.ko.md#설정과-provider)에 있습니다.

## 공급과 설치

Archive 디렉터리에는 Core·SDK·Skia-native·Skia-RN·Skia-Web·Metro·CLI·Static AOT tooling과 선택한 Material·Cupertino 패키지가 각각 하나씩 필요합니다. 서로 호환되는 한 묶음을 사용하세요.

이 저장소에서는 SDK 빌드 후 archive를 pack합니다. Web archive에는 [준비된 CanvasKit 런타임](../../../skia/eng/source-build/README.md#vendor-build-recipes)도 필요합니다. 저장소 루트에서는 `nelyx` 대신 `node Nelyx/sdk/tooling/cli/src/main.mjs`로 소스 CLI를 실행할 수 있습니다.

```text
nelyx supply --app MyApp --target web --packages <archive-directory>
npm --prefix MyApp/web/runner ci --workspaces=false
```

공급 명령은 앱의 `.nelyx/supply/<target>/`에 archive를 복사하고 runner manifest·lockfile을 갱신합니다. 같은 버전의 archive 내용이 바뀐 경우에도 runner를 다시 설치해야 합니다. 공통 소스·설정은 앱 루트에, 의존성은 각 runner에 둡니다.

## 대상별 명령

설치 후 `MyApp/web/runner/`에서 실행합니다.

```powershell
npx --no-install nelyx doctor --app ../.. --target web
npx --no-install nelyx prepare --app ../.. --target web
npx --no-install nelyx build --app ../.. --target web
npx --no-install nelyx run --app ../.. --target web --port 8080
```

마지막 명령이 빌드된 패키지를 `http://127.0.0.1:8080/`으로 제공합니다.

| 명령 | 용도 |
| --- | --- |
| `doctor` | 대상 도구와 provider 정보 확인 |
| `prepare` | Runner 설정 생성과 네이티브 입력 준비 |
| `build` | 선택한 대상 빌드 |
| `dev` | 개발 서비스와 구성된 네이티브 앱 시작 |
| `run` | 기존 네이티브 패키지 실행 또는 Web 패키지 제공 |
| `pack` | 빌드된 패키지를 새 경로로 내보내기 |

개발은 `npx --no-install nelyx dev --app ../.. --target web`을 사용하며 기본 port는 8081입니다. 내보내기는 `npx --no-install nelyx pack --app ../.. --target web --output <new-path>`입니다. 서버는 Ctrl+C로 종료합니다.

대상별 옵션 조합은 [src/main.mjs](src/main.mjs)에 정의되어 있습니다.

Windows RNW의 `run`은 앱 소스·에셋·Windows 설정과 설치된 Nelyx SDK 내용을 패키지에 기록된 입력과 비교합니다. 변경이 있으면 기존 엔진·실행 모드·compiler profile·빌드 구성을 유지해 재빌드합니다. 변경이 없으면 기존 패키지를 사용하고, 입력 기록이 없는 이전 패키지는 한 번 재빌드합니다. 빌드 실패 또는 빌드 도중 입력 변경 시 앱을 실행하지 않습니다. 외부 앱은 SDK 패키지를 먼저 공급·설치하세요. 저장소 Testbed의 `run:windows`는 저장소 SDK 패키지도 자동 갱신합니다. 특정 패키지를 재빌드 없이 실행하려면 `run --package <directory>`를 사용하세요.

기존 외부 앱은 앱·SDK 입력 기록과 네이티브 SDK 헤더 무효화를 위해 `windows/runner/build.mjs`를 현재 starter 템플릿으로 한 번 갱신하세요. 저장소 Testbed에는 이 갱신이 포함되어 있습니다.

## 네이티브 준비 조건

| 대상 | 필요한 준비 |
| --- | --- |
| Windows | Visual Studio C++ 도구, Windows SDK와 호환되는 x64 렌더러 공급 파일 |
| Android | OpenJDK 21, Android SDK·NDK와 호환되는 렌더러 입력 |
| iOS / macOS | macOS, Xcode, Pods와 대응하는 네이티브 패키지 |
| Linux | GTK4·X11, 고정된 RNL·Hermes 소스와 명시적인 네이티브 입력 manifest |

네이티브 공급은 [Skia 가이드](../../../skia/README.ko.md)를 참고하세요.

Windows 기본값은 RNW 호스트와 Hermes bytecode입니다. 준비·빌드에서 `--engine hermes|v8|jsc`를 선택합니다. Hermes는 `--hermes-mode bytecode|static-aot`를 지원하며 Static AOT에는 x64 Release·optimized compiler profile이 필요합니다. JSC는 `--jsc-mode jit|interpreter`를 받습니다. V8·JSC·Static Hermes에는 각각 준비된 엔진 공급 파일이 필요하고 `--engine-inputs`로 재사용합니다.

실험적인 직접 Hermes 호스트는 `--host native-hermes`를 사용합니다. 설치된 Windows runner에서 실행합니다.

```text
npx --no-install nelyx prepare --app ../.. --target windows --host native-hermes --native-inputs <inputs.json>
npx --no-install nelyx build --app ../.. --target windows --host native-hermes --hermes-mode bytecode
npx --no-install nelyx run --app ../.. --target windows --host native-hermes --hermes-mode bytecode
```

네이티브 AOT 모드는 `bytecode` 대신 `static-aot`로 빌드·실행합니다. 직접 호스트 빌드에는 LLVM·CMake·Ninja도 필요합니다. 현재 패키지는 앱의 `.nelyx/native-windows/current-bytecode/`·`current-static-aot/`에 있습니다.

Windows RNW 출력은 고정된 `.nelyx/windows/packages/Release/`·`Debug/`를 사용합니다. 재빌드 전에 실행 중인 패키지를 닫고, 네이티브 공급 파일을 바꾸면 준비 명령을 반복하세요.

Android 빌드는 호환되는 앱 profile과 `--architecture arm64-v8a|x86_64`를 사용하며 Release 패키징은 `--configuration Release`입니다. `run`의 기기는 `--device <adb-serial>`로 선택합니다. Debug·Metro 경로는 `dev`를 사용합니다.

## Linux 공급

`nelyx supply --app <app> --target linux --packages <archive-directory> --rnl-supply <supply.json>`으로 해시를 확인한 RNL archive도 공급합니다.

고정된 깨끗한 RNL checkout을 `node <cli>/src/prepare-rnl.mjs <checkout> <new-staging>`으로 준비합니다. Staging에서 패키지를 설치·빌드한 뒤 `node <cli>/src/pack-rnl.mjs <staging>`을 실행합니다. `<cli>`는 설치된 CLI 패키지 디렉터리입니다. 기준 pin·overlay는 [upstream/](../../../upstream/)에 있습니다.

## 템플릿과 라이선스

[templates/nelyx-app/](templates/nelyx-app/)에 앱 진입점과 runner별 가이드가 있습니다. SDK는 앱 호스트 수명을, Skia는 그래픽 자원을 관리합니다.

Nelyx는 실험적인 프로젝트이며 플랫폼 제약은 [프로젝트 가이드](../../../../README.ko.md#프로젝트-상태)에 있습니다. Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따르며 가져온 템플릿·런타임의 고지를 유지합니다.
