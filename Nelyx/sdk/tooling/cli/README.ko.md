# Nelyx CLI

[English](README.md) | **한국어**

CLI0.10.0 template는 core0.16.0·SDK0.20.0·Skia0.6.0·Metro0.10.0과 선택한 Material/Cupertino0.1.0을 함께 공급합니다. `create --designs none|material|cupertino|material,cupertino`로 디자인 의존성과 앱 소스를 선택합니다. native supplier·paragraph·keyboard 계약과 폰트 notice 검사는 유지합니다. [SDK 구성 안내](../../README.ko.md)를 참고하세요.

`@nelyx/cli`는 패키지에 포함된 템플릿으로 앱을 생성하고 대상별 준비·빌드·개발·실행·패키징을 관리합니다. Node.js **>=24.3.0 <25**를 사용합니다. 저장소 샘플은 [샘플 가이드](../../../../sample/nelyx-testbed-app-2/README.ko.md)에서 시작하세요.

기본 앱 소스와 6개 플랫폼 runner는 독립된 [`templates/nelyx-app`](templates/nelyx-app/)에서 직접 관리합니다. Components Gallery의 소스를 템플릿으로 복사하지 않습니다.

루트 `package.json`이 앱 구성의 기준입니다. `app.json`, `application.json`, `nelyx.config.ts`와 루트 bootstrap 파일은 필요하지 않습니다. npm 패키지 `name`과 네이티브 앱 등록 이름인 `nelyx.name`은 구분하며, 표시 이름은 `nelyx.displayName`에 둡니다. 번들 이미지(Apple/Linux에서는 폰트도)를 추가할 때 runner main의 자산 map에 정적인 `require` 항목을 추가해 Metro에 포함합니다. Windows는 선언된 자산 전체를 host URI로, Android는 폰트를 hash 기반 네이티브 자산 URI로 연결합니다. CLI prepare는 네이티브 빌드 도구용 `runner/app-config.json`을 계속 생성합니다. 이 파일 대신 루트 패키지 구성을 수정하고 prepare로 갱신하세요.

에셋과 notice의 `sha256`은 생략할 수 있으며 기본 앱 구성에는 넣지 않습니다. runner 준비·타입 검사·Metro 시작 시 현재 파일에서 자동 계산해 생성되는 `runner/app-config.json`에만 저장하고 루트 패키지는 수정하지 않습니다. 각 runner main은 이 내부 자산 메타데이터를 확인한 뒤 등록합니다. 패키지 자산은 설치된 원본과 비교해 복사하며 수정된 기존 대상 파일은 보존하고 오류로 보고합니다. 명시한 해시가 있다면 일치 여부도 확인합니다.

## 앱 생성

CLI를 설치하고 로컬 archive 디렉터리를 준비한 상태에서 실행합니다.

```text
nelyx create MyApp --name MyApp --target web --packages <archive-directory>
```

대상 디렉터리는 비어 있어야 합니다. 앱 이름은 영문 대문자로 시작하고 영문·숫자만 포함합니다. 대상은 `windows`, `android`, `ios`, `macos`, `linux`, `web` 중 하나를 명시적으로 선택합니다.

생성 시 runner manifest를 쓰며 lockfile은 만들지 않습니다. 새 Web runner는 `npm --prefix MyApp/web/runner install --workspaces=false`로 처음 설치합니다. 이후 `supply`가 lockfile을 갱신하면 아래의 `ci`로 설치된 패키지를 새 archive에서 교체합니다.

`--packages`에는 `@nelyx/core`, `@nelyx/sdk`, `@nelyx/skia-rn`, `@nelyx/skia-web`, `@nelyx/metro`, `@nelyx/cli` archive가 각각 하나씩 필요합니다. 선택한 디자인마다 Material/Cupertino archive도 하나씩 포함합니다. `--designs none`은 둘 다 제외하며 기본값은 둘 다 선택합니다. SDK 빌드 후 저장소 루트의 PowerShell에서 생성합니다.

```powershell
New-Item -ItemType Directory -Force Nelyx/.cache/packages/manual | Out-Null
foreach ($package in @('core', 'sdk', 'skia-rn', 'skia-web', 'metro', 'cli', 'material', 'cupertino')) {
    npm pack --workspace "@nelyx/$package" --pack-destination Nelyx/.cache/packages/manual --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw "Packing failed: $package" }
}
```

이전 버전 archive가 없는 디렉터리를 사용하고 절대 경로를 `--packages`에 전달합니다. 옵션을 생략하면 runner가 패키지 버전을 참조하므로 설정된 registry에서 해당 버전을 공급해야 합니다.

## 공급과 설치

설치된 `nelyx` 명령을 사용할 수 있는 디렉터리에서 실행합니다.

```text
nelyx supply --app MyApp --target web --packages <archive-directory>
npm --prefix MyApp/web/runner ci --workspaces=false
```

공급 명령은 archive를 앱 소유 `.nelyx/supply/<target>/`에 복사하고 runner manifest·lockfile을 갱신합니다. Runner 의존성 트리는 따로 설치합니다. 생성 앱은 공통 소스·설정을 루트에, 런타임 의존성을 독립 runner에 둡니다.

## 대상별 명령

설치 후 `MyApp/web/runner/`에서 실행합니다.

```powershell
npx --no-install nelyx doctor --app ../.. --target web
npx --no-install nelyx prepare --app ../.. --target web
npx --no-install nelyx build --app ../.. --target web
npx --no-install nelyx run --app ../.. --target web --port 8080
```

`run`은 빌드한 Web 패키지를 `http://127.0.0.1:8080/`에서 제공합니다. 개발에는 8081 포트의 `npx --no-install nelyx dev --app ../.. --target web`을, 빌드 패키지 내보내기에는 `npx --no-install nelyx pack --app ../.. --target web --output <new-path>`를 사용합니다. 서버는 Ctrl+C로 종료합니다.

Windows `build` 출력은 시간 없는 `.nelyx/windows/packages/Release/`와 `Debug/`로 고정합니다. 임시 패키지를 검증한 뒤 해당 구성의 출력을 교체하고 실행 경로를 갱신하며, 교체 실패 시 이전 패키지로 복원합니다. 같은 출력의 앱이 실행 중이면 종료 후 다시 빌드합니다. staging·교체용 백업은 실행 종료 시 정리하고, 성공한 빌드는 같은 앱의 이전 시간별 패키지도 정리합니다. 다른 고정 구성·관리 폴더 밖 출력·다른 앱·수정된 패키지·링크는 보존합니다. 명시적 `--output`은 새 디렉터리가 필요하며 `cleanup.removed`·`cleanup.retained`에 정리 결과와 보존 이유를 표시합니다.

| 명령 | 용도 |
| --- | --- |
| `doctor` | 대상별 도구·provider 정보 출력 |
| `prepare` | runner 설정 생성과 명시적 네이티브 입력 준비 |
| `build` | 선택한 대상 패키지 빌드 |
| `dev` | 개발 서버와 구성된 네이티브 앱 실행 관리 |
| `run` | 기존 네이티브 패키지 실행 또는 빌드한 Web 패키지 서비스 |
| `pack` | 빌드한 대상 패키지를 새 목적지로 내보내기 |

옵션은 대상마다 다릅니다. 허용되는 조합은 [`src/main.mjs`](src/main.mjs)의 parser에 있습니다. Doctor 결과나 pack 출력은 기기 실행·제품 서명을 입증하지 않습니다.

## 네이티브 준비 조건

Windows prepare/build는 `--native-inputs <inputs.json>`을 받아 hash·소스 목록·ABI를 확인합니다. Linux prepare에는 해당 manifest가 필수이며, 빌드에는 고정된 RNL/Hermes 네이티브 소스도 필요합니다. [Skia 공급 가이드](../../../skia/README.ko.md)를 참고하세요.

wire 6 effects와 기존 rounded/Path/matrix/paint/layer는 현재 core/SDK/renderer archive 및 재빌드 native supplier를 맞춰 사용하며 native ABI는 1을 유지합니다. local archive 교체 후 runner 설치와 installed source hash 비교로 갱신을 확인하세요. C++ compiled-source supplier 재빌드는 Windows runner 가이드에 설명합니다.

Android CLI 패키지에는 `--configuration Release`가 필요하며 `--architecture arm64-v8a|x86_64`를 받습니다. Run은 `--device <adb-serial>`을 사용하고 Debug/Metro 개발은 별도 `dev` 명령을 사용합니다. Apple 네이티브 명령에는 macOS/Xcode가 필요하며, 명시적 준비 단계에서 소스 hash·protocol이 일치하는 런타임 patch를 적용합니다.

실행 전에 입력과 의존성을 준비합니다. SDK import가 다운로드, vendor 소스 빌드나 개발 서버를 시작하지 않습니다.

Windows의 `prepare`와 `build`는 `--engine hermes|v8|jsc`를 받습니다(기본 Hermes). `prepare --engine v8`는 고정 Microsoft V8 24.1.10과 RNW 0.83.2/native RN 0.83.4의 소스 공급본을 만들고, `--engine-inputs <supplier 폴더>`는 검증된 기존 공급본을 연결합니다. `build --engine v8`는 별도 profile/cohort·실제 VM 식별·JS 소스 번들·portable map·DLL/notice 검사를 사용합니다. `run`/`pack`은 선택한 패키지의 엔진을 검증하며 같은 구성의 고정 출력/locator 규칙을 유지합니다. `build --engine hermes`로 돌아갈 수 있습니다. V8의 Hermes inspector와 개발 갱신은 지원하지 않으며 native/성능 검증 범위는 앱의 작업 문서를 따릅니다.

Windows x64 Release의 실험 경로는 `--engine hermes --hermes-mode static-aot`입니다. prepare는 고정 `94aa5e1d` compiler/runtime을 만들거나 `--engine-inputs`의 검증된 입력을 재사용합니다. 자동 정책은 검증된 scalar body의 인수를 검사해 특화하고, field·getter·callback·class·collection은 같은 native image의 일반 JS 표현으로 유지합니다. 전체 source/body/native 대응이나 타입 정책 근거가 누락되면 패키지를 거절합니다. AOT root는 앞선 source·bytecode 실행을 거절하고 native 시작 후 fallback도 금지합니다. VM의 eval/JIT는 꺼져 있습니다. `mapStaticAotPc` API는 DLL hash와 PE/PDB identity가 연결된 RVA를 원본 함수 후보로 대응하며 정밀도는 함수 범위입니다. 중간 C/PDB와 staging은 실행 종료 시 삭제합니다. runner는 배포물 밖의 `.nelyx/windows/static-aot-cache` 한 곳에 현재 object·함수 대응을 교체하며, 입력·도구·옵션 및 DLL hash가 같은 빌드는 native 컴파일을 생략합니다. 부분 변경은 해당 unit만 재컴파일하며 Metro는 코드와 frontend 검증 근거를 함께 재사용합니다. 캐시 삭제 시 재생성하고 과거 출력은 누적하지 않습니다. 준비에는 여유20GiB·VS C++·LLVM clang/clang-cl·CMake·Ninja가 필요합니다. 프로세스당 앱 로드1회이며 Debug·개발 갱신은 범위 밖입니다. 실제 기능·수명·성능 수락은 별도 gate입니다.

## Windows 직접 Hermes host

Windows Release의 기본 엔진은 **Hermes**, 기본 compiler profile은 `optimized`입니다. 기본 host는 RNW를 유지합니다. iOS까지 이어지는 공통 native runtime 방향은 Hermes로 두고 V8/JSC는 명시적으로 선택합니다.

실험적 직접 host는 `doctor|prepare|build|run|pack`의 `--host native-hermes`로 선택합니다. HWND·전용 직접 Hermes JSI thread·Skia Vulkan/DirectComposition·TSF editor·가상 UIA 트리를 SDK가 소유하며 기존 `main().definition`과 선언 자산을 사용합니다. Windows x64 Release, VS C++ 도구, LLVM, CMake/Ninja와 고정 Skia 공급본이 필요합니다. 설치된 Windows runner에서 실행합니다.

```powershell
npx --no-install nelyx prepare --app ../.. --target windows --host native-hermes --native-inputs <Skia-supplier-inputs.json>
npx --no-install nelyx build --app ../.. --target windows --host native-hermes --hermes-mode bytecode
npx --no-install nelyx run --app ../.. --target windows --host native-hermes --hermes-mode bytecode
npx --no-install nelyx build --app ../.. --target windows --host native-hermes --hermes-mode static-aot
npx --no-install nelyx run --app ../.. --target windows --host native-hermes --hermes-mode static-aot
```

공급본이나 toolchain을 변경하면 build 전에 prepare를 다시 실행해 현재 입력을 검증하고 locator를 갱신합니다. prepare는 검증한 native 입력과 별도 direct-Hermes toolchain을 기록합니다. 같은 검증된 공급본은 `--engine-inputs <directory>`로 재사용합니다. 현재 두 패키지는 `.nelyx/native-windows/current-bytecode`, `current-static-aot`에서 교체하며 재빌드 전 해당 창을 닫습니다. Static 빌드는 자동 타입 정책·전체 native coverage를 요구하고 source/bytecode fallback을 거절합니다. `pack --host native-hermes --hermes-mode <mode> --output <new.zip>`으로 내보냅니다. 성능·물리 IME/입력·실제 표시·전체 기능 수락은 [W17](../../../../history/26/10/25/work17-summary.md)에 열려 있습니다. Debug·Metro 갱신·다른 플랫폼의 직접 host는 미구현입니다.

## Linux 공급

`nelyx supply --app <app> --target linux --packages <archive-directory> --rnl-supply <supply.json>`은 hash를 확인한 RNL archive도 공급합니다.

`node <cli>/src/prepare-rnl.mjs <clean-pinned-checkout> <new-staging>`으로 깨끗한 고정 버전 RNL checkout을 준비합니다. Staging에서 의존성을 설치하고 패키지를 빌드한 뒤 `node <cli>/src/pack-rnl.mjs <staging>`으로 압축합니다. `<cli>`는 설치된 CLI 패키지 디렉터리입니다.

정식 pin·overlay·patch는 [`Nelyx/upstream/`](../../../upstream/)에 있습니다. 배포 CLI의 `upstream/` 자산은 저장소 빌드에서 생성합니다.

## 템플릿과 라이선스

[`templates/nelyx-app/`](templates/nelyx-app/)에는 공통 `src/index.ts` 진입점과 플랫폼 runner가 있습니다. SDK 네이티브 호스트가 앱 수명 정책을, Skia가 GPU·JSI·component를 관리합니다. 책임 경계는 [SDK 가이드](../../README.ko.md)를 참고하세요.

Nelyx 작성 코드는 [BSD-3-Clause](LICENSE.md)를 따릅니다. Upstream 템플릿·런타임 고지는 수입 소스와 함께 유지합니다. 플랫폼 qualification, 전체 reload/loss recovery와 제품 서명은 `notVerified`입니다.


local archive 공급 후 runner에서 npm install을 실행해 실제 패키지를 설치합니다. 공급은 regular lock을 갱신하면서 실제 설치된 패키지의 hidden lock을 보존하므로 동일 version의 다른 archive도 다음 설치에서 감지합니다.

Static Hermes AOT 도구 패키지는 `@nelyx/static-aot`, CLI export는 `@nelyx/cli/windows-static-aot`입니다. public 모드는 `bytecode|static-aot`이며 호환 별칭은 없습니다. v5 native plan은 typed unit·Metro root·RNW JSI manager를 한 image/VM에 연결합니다. RNW manager는 원본 문자열과 URL이 일치하는 실제 첫 요청에서 native unit으로 한 번 초기화합니다. VM 내부 Promise/iterator JavaScript도 native입니다. 원본·body ledger·타입 정책·PC map과 두 runtime script의 hash를 함께 검증하며 변경한 공급은 재설치·재빌드해야 합니다.

Windows runner 템플릿은 시작 시 React 오류와 런타임이 제공하는 stack frame을 OutputDebugString으로 전달합니다. Native AOT 주소는 mapStaticAotPc로 원본 함수 범위에 대응할 수 있습니다.
