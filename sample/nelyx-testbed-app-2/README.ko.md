# Nelyx Testbed

[English](README.md) | **한국어**

Nelyx의 Material 3·Cupertino 컴포넌트를 살펴보는 공통 TypeScript 앱입니다. 컴포넌트 갤러리, 텍스트 편집·폼, 화면 전환, 테마 설정과 ListView 예제를 제공합니다.

Web·Windows·Android에서 [src/](src/)를 공유하고, 각 대상은 자체 runner·의존성·빌드 설정을 사용합니다.

Material 갤러리의 **입력·버튼 스크롤**에서 텍스트필드 12개와 버튼 36개를 섞은 페이지를 엽니다. lazy builder 없이 하나의 스크롤 영역 안 `Column`에 모든 항목을 한 번에 생성합니다. 편집 후 스크롤 왕복, 전송·횟수·초기화, 처음·끝 이동을 확인할 수 있습니다.

## 준비 조건

Node.js **>=24.3.0 <25**, npm과 Python 3가 필요합니다. 대상별 준비 전에 저장소 루트에서 실행합니다.

```powershell
npm ci
npm run build:sdk
```

이 문서의 명령은 저장소 루트 기준입니다. PowerShell에서 `--` 뒤로 네이티브 옵션을 전달할 때는 `npm.cmd`를 사용하세요. Windows `run:windows`는 변경된 저장소 SDK·디자인 패키지를 갱신하고 앱 소스·에셋·Windows 설정 또는 SDK 내용이 바뀌면 재빌드합니다. 변경이 없으면 현재 패키지를 재사용합니다. 다른 대상은 소스를 수정하면 SDK 빌드, 대상별 공급, runner 설치와 대상 빌드를 반복합니다.

## Web 실행

WebGL2 브라우저와 대응하는 소스 빌드 CanvasKit 런타임이 필요합니다. 새 checkout에서는 [런타임 준비 가이드](../../Nelyx/skia/eng/source-build/README.md#vendor-build-recipes)를 먼저 따르세요.

```powershell
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
npm run prepare:sample -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts --workspaces=false
npm run dev:web --workspace @nelyx/testbed-2
```

`http://127.0.0.1:8081/`에 접속하고 Ctrl+C로 서버를 종료합니다. 정적 빌드는 다음 명령을 사용합니다.

```powershell
npm run build:web --workspace @nelyx/testbed-2
```

출력은 이 앱의 `.nelyx/web/`에 생성됩니다. CLI 패키지 제공·내보내기는 [Web runner 가이드](web/runner/README.md)에 있습니다.

## Windows

Windows 기본값은 **RNW 호스트의 Hermes bytecode·optimized Release**입니다. 같은 패키지를 재빌드하기 전에 Testbed 창을 닫으세요.

### Windows 준비

Visual Studio C++ 도구와 Windows SDK를 설치합니다. [Skia 가이드](../../Nelyx/skia/README.ko.md#windows-네이티브-입력)에 따라 대응하는 렌더러 공급 파일을 준비하세요. 공급 파일은 설치된 runner의 네이티브 소스와 일치해야 합니다.

```powershell
npm.cmd run prepare:sample -- windows
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner install --ignore-scripts --workspaces=false
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --native-inputs "C:\path\to\supplier\inputs.json"
```

예시 경로를 실제 공급 파일의 `inputs.json`으로 바꾸세요. 공급 파일을 컴파일할 때는 runner를 먼저 설치해야 합니다. 준비 명령이 네이티브 입력을 기억하며, 공급 파일을 교체하면 다시 준비합니다.

Windows frame clock은 네이티브 protocol version 2를 요구합니다. 이전 공급본에서 갱신한다면 공급 파일을 재빌드하고 입력 준비와 앱 빌드를 다시 수행하세요. 예측 frame target은 선택 작업의 예산이며 표시 완료 receipt가 아닙니다.

### 실행 모드 선택

| 모드 | 저장소 루트 실행 명령 |
| --- | --- |
| Hermes bytecode·optimized Release | `npm.cmd run start:windows:hermes --workspace @nelyx/testbed-2` |
| V8 | `npm.cmd run start:windows:v8 --workspace @nelyx/testbed-2` |
| JSC JIT | `npm.cmd run start:windows:jsc --workspace @nelyx/testbed-2` |
| JSC interpreter | `npm.cmd run start:windows:jsc:interpreter --workspace @nelyx/testbed-2` |
| Hermes bytecode·debug compiler profile | `npm.cmd run start:windows:hermes:debug --workspace @nelyx/testbed-2` |
| SDK 변경 시 재빌드 후 실행 | `npm.cmd run run:windows --workspace @nelyx/testbed-2` |

`run:windows`는 저장소와 설치된 SDK의 실제 파일 내용을 비교해 오래된 TypeScript 출력을 빌드하고, 변경된 패키지를 공급·재설치합니다. 설치 SDK가 마지막 앱 패키지와 다르면 앱도 재빌드하며 기존 엔진·AOT/bytecode·compiler profile·Debug/Release 설정을 유지합니다. 변경이 없으면 기존 패키지를 사용하고, 입력 추적 이전 패키지는 한 번 재빌드합니다. 재빌드 전에는 기존 Testbed를 닫으세요. 빌드 실패 시 앱을 실행하지 않습니다. Runner에서 명시한 `run -- --package <directory>`는 선택한 패키지를 갱신 없이 실행합니다.

V8은 처음 빌드하기 전에 한 번 준비합니다.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --engine v8
```

**Static Hermes AOT**는 runner 준비 후 실행 스크립트를 사용합니다.

```powershell
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1
```

스크립트가 compiler·runtime을 준비하고 optimized Windows x64 Release 패키지를 빌드해 실행합니다. SDK 변경 후에는 `-RefreshSdk`를 추가하면 빌드·공급·runner 설치부터 수행합니다. 최초 compiler·runtime 준비에는 Visual Studio C++ 도구, LLVM clang·clang-cl, CMake, Ninja와 여유 공간 20 GiB가 필요합니다.

같은 스크립트로 **JSC**를 준비하고 실행할 수 있습니다.

```powershell
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode jit
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode interpreter
```

스크립트의 기본 엔진은 Static Hermes이며 일반 npm 빌드의 기본값은 Hermes bytecode입니다. JSC는 소스 JavaScript를 사용하고 모드를 변경할 때 새 프로세스가 필요합니다. V8·JSC·Static Hermes는 각각 대응하는 엔진 입력을 준비해야 합니다.

### 빌드·실행 옵션

Runner에 옵션을 직접 전달합니다.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-mode bytecode --hermes-profile debug --configuration Debug
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

| 옵션 | 값과 용도 |
| --- | --- |
| `--engine` | `hermes`·`v8`·`jsc`, 기본 Hermes |
| `--hermes-mode` | `bytecode`·`static-aot`, AOT는 Hermes·Release·optimized profile 필요 |
| `--hermes-profile` | `optimized`·`debug`, Release 기본 optimized·Debug 기본 debug |
| `--jsc-mode` | JSC의 `jit`·`interpreter` |
| `--configuration` | `Release`·`Debug` |
| `--native-inputs` | 대응하는 렌더러 공급 manifest |
| `--engine-inputs` | 선택한 엔진의 검증된 공급·toolchain 경로 |

`run`은 마지막 빌드 패키지를 엽니다. 출력을 직접 지정할 수도 있습니다.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run run -- --package ../../.nelyx/windows/packages/Release
```

상대 패키지 경로는 runner 디렉터리 기준입니다. 고정 출력은 이 앱의 `.nelyx/windows/packages/Release/`·`Debug/`입니다.

Gallery는 스크롤 중 위치만 바뀌는 접근성 계산을 최대 300ms 간격으로 합치고, 마지막 움직임 뒤 100ms가 지나면 최종 위치를 반영합니다. 포커스·값·활성 상태 변경과 접근성 동작은 기다리지 않으며 IME 입력 좌표는 매 프레임 갱신합니다. 앱의 `semanticsUpdateInterval`로 간격을 조정할 수 있고, `0`은 매 변경 프레임을 반영합니다.

All Components의 indexed section 목록에는 `childPolicy: {mode: 'bounded', capacity: 2, preparation: 'disabled'}`를 적용했습니다. 가까운 섹션의 State와 paint recording을 보존해 되돌아올 때 재사용합니다. 엔진의 목록별 `capacity`는 선택 보존할 섹션 `0`~`8`개(기본 `8`)이며, View 전체의 optional child 16개·Element 2,048개 한도 안에서 동작합니다. 편집기의 명시적 keep-alive는 별도이며, capacity를 줄이면 일반 layout 경로로 선택 보존 섹션을 정리합니다. 섹션은 필요할 때 생성하므로 복잡한 섹션의 첫 build에는 긴 프레임이 남을 수 있습니다.

저장소 루트에서 `node Nelyx/eng/profile-gallery-scroll.mjs`를 실행하면 실제 Gallery의 Node/CanvasKit CPU 단계 비용을 확인할 수 있습니다. `--profile`은 메모리 안에서 CPU 표본을 수집하며 비용이 큰 함수와 부모 호출 경로도 함께 출력하고, `--entries`는 긴 프레임의 문단 측정을 분리하며, `--viewport=wide`는 두 열 화면을 사용합니다. `--pictures`는 제품과 같은 bounded Picture 소유자를 사용해 유지된 레이어의 합성과 native Picture 생성 비용도 측정합니다. `--hover`는 텍스트필드와 All Components의 ElevatedButton 안팎에 고정한 합성 마우스로 같은 구간을 스크롤하며 rebuild/layout 횟수도 비교합니다. `pointer-sweep` 구간은 스크롤을 고정하고 포인터를 컨트롤과 헤더 사이로 옮기며, `includesPointerDispatch: true`로 입력 전달 시간을 포함한 CPU 수치를 구분합니다. `--viewport=wide`와 함께 쓰면 실제 All Components 두 열의 텍스트필드 구간도 측정합니다. Material의 그림자·색상 애니메이션은 paint 경로에서 갱신하며, 도형·방향과 사용자 상태별 layout 변경도 반영합니다. `--children=legacy`는 fixture에서만 보존 정책을 비교합니다. profile 파일을 저장하지 않으며, 이 수치를 native FPS나 물리 트랙패드·표시 성능으로 해석하지 않습니다.

`gallery-all-text-hover-burst` 진단은 두 컬럼을 스크롤하면서 source 프레임마다 hover 입력 4개를 전달합니다. `hitTransforms.unused`는 pointer handler가 없는 대상의 좌표 변환 조회 횟수입니다. Native Gallery fixture에도 스크롤 중 hover를 queue에 넣는 구간이 있습니다. 둘 다 통제된 작업 부하이며 물리 입력의 체감 수락과 구분합니다.

GPU 기본값은 주 모니터에 연결된 하드웨어 adapter입니다. 실행 전에 `NELYX_WINDOWS_GPU_VENDOR`를 설정해 제조사를 선택할 수 있습니다. 예를 들어 AMD는 `4098`입니다.

### C++ 모듈을 직접 실행

Testbed 창을 닫고 저장소 루트에서 실행합니다. 창이 열리면 사용자가 직접 마우스·트랙패드·키보드로 조작하고 닫습니다.

```powershell
npm.cmd run run:windows:cpp
```

기본 `all`은 **retained 입력 좌표 + Path/Paint·clip + Scene composition + Semantics geometry + Flex layout + text transaction + frame segment + Windows backing 재사용**을 함께 선택합니다. `npm.cmd run run:windows:cpp -- --module=all`도 같은 명령입니다. Gallery와 입력·버튼 스크롤 제목의 `C++ all` 표시로 선택을 확인할 수 있습니다. `입력·버튼 스크롤`을 열어 편집기 입력·스크롤을 확인하면 retained 좌표 경로에도 실제 수요가 생깁니다. 공개 custom hook 등 지원 범위 밖의 작업은 사유를 집계하는 TS fallback입니다. Snapshot 입력 좌표는 retained의 대안이며 별도 모드로 선택합니다.

모듈 하나만 켜거나 같은 수동 실행에서 TS control을 선택할 수 있습니다.

```powershell
npm.cmd run run:windows:cpp -- --module=path
npm.cmd run run:windows:cpp -- --module=retained
npm.cmd run run:windows:cpp -- --module=snapshot
npm.cmd run run:windows:cpp -- --module=backing
npm.cmd run run:windows:cpp -- --module=layout
npm.cmd run run:windows:cpp -- --module=text
npm.cmd run run:windows:cpp -- --module=frame
npm.cmd run run:windows:cpp -- --module=scroll-input
npm.cmd run run:windows:cpp -- --module=scroll-frame
npm.cmd run run:windows:cpp -- --module=pointer-targets
npm.cmd run run:windows:cpp -- --module=section-lifetime
npm.cmd run run:windows:cpp -- --module=scroll
npm.cmd run run:windows:cpp -- --module=ts
```

`--module` 값은 `all`, `retained`, `snapshot`, `path`, `paint`, `composition`, `semantics`, `backing`, `layout`, `text`, `frame`, `scroll-input`, `scroll-frame`, `pointer-targets`, `section-lifetime`, `scroll`, `ts`입니다. `npm.cmd run run:windows:cpp --workspace @nelyx/testbed-2`도 같은 기본 모드를 실행합니다. 수동 모드는 자동 입력·종료·해상도 제한 없이 실행하며 native 실제 작업 수만 집계합니다. 창을 닫으면 `NATIVE_MODULE_RESULT`의 `modules`, `native`, `fallback`, `inputGeometry`, `engine`으로 독립 native 집계와 SDK 집계·정리를 확인합니다. `observed`는 해당 owner에서 native 작업을 관측했다는 뜻이며, `notObserved`는 native 작업을 확인하지 못했다는 뜻입니다. `fallbackOnly`는 TS fallback만 관측한 모듈이며 exit 2를 반환합니다. 이 수치를 성능 향상이나 전체 작업의 C++ 처리 보증으로 쓰지 않습니다.

`backing`은 Windows N4 실험을 선택하며 전체 구간 coverage 관측도 설치합니다. 같은 native surface 세대의 Vulkan image/memory를 유지하고 frame별 fence·완료 검사는 수행합니다. `all`에서도 함께 활성화합니다. 결과의 `backing`에서 native/SDK create·reuse 집계, 3개 / 64 MiB 상한, drain 후 live backing 0을 확인합니다.

`layout`(N1)은 표준 Flex의 숫자 배분·배치를 C++로 계산하며 TS child layout callback을 유지합니다. dry/intrinsic/baseline·custom hook은 사유를 집계하는 TS fallback입니다. `text`(N2)는 기존 cache miss에서 paragraph 구성·layout·metrics 조회를 묶습니다. `frame`(N3)은 닫힌 command segment를 봉인하고 변경 가능한 자원을 snapshot하여 GPU recording 완료까지 native lease를 유지합니다. 세 모드는 coverage 관측을 포함하고 시작 시 해당 native capability를 요구하며, `engine`에 실제 작업·fallback·회수 결과를 보고합니다. Frame segment 상한은 metadata의 계산된 비용이며 전체 GPU·process 메모리 측정치는 아닙니다. 세 모드는 `all`에서도 함께 활성화하며 각 모듈의 결과를 독립 검증합니다. 일반 App의 기본값은 TS입니다.

`scroll-input`은 실제 DirectManipulation poll과 순서 있는 입력 batch, `scroll-frame`은 실제 native credit에 의한 재개, `pointer-targets`는 순수한 단일 자식 경로의 bounds·translation을 묶어 계산한 뒤 현재 TS boundary·self hook을 호출하는 질의, `section-lifetime`은 기존 Element 예산 안의 optional 보존·퇴출·준비 결정을 선택합니다. `scroll`은 네 후보를 함께 선택하며 `all`에도 실험 연결이 포함됩니다. 지원 밖의 pointer hook은 현재 TS 동작을 유지합니다. 현재 **NO_ADOPTION 실험**이며 OS-wheel 비교에서 일관된 이득을 입증하지 못했고 물리 터치패드 timing은 미검증입니다. 실패한 gate와 현재 범위는 [work7](../../history/26/11/04/work7-summary.md#구현과-실행-검증)을 확인하세요. 작업 0은 `notObserved` 또는 `fallbackOnly`로 남습니다.

W7 전체 구간 비교는 fresh owner를 사용하며 작업 0의 실패를 보존합니다. OS wheel로 DirectManipulation 경로를 수락하지 않습니다.

```powershell
npm.cmd run experiment:native-scroll -- --trials=3 --modes=ts,scroll-frame,pointer-targets,section-lifetime,scroll-input,scroll --functional
```

명령은 현재 native/SDK 공급으로 수동 package를 빌드하고 App 원문을 자동 복구한 뒤 실행합니다. 실행 후 일반 기본 App으로 돌아가려면 `npm.cmd run run:windows --workspace @nelyx/testbed-2`를 사용하세요.

### C++ 성능 후보 재실험

현재 source와 일치하는 native supplier를 준비하고 Testbed 창을 닫은 뒤 저장소 루트에서 실행합니다. 현재 비교 helper는 최대화한 client 영역 2560×1459 physical / DPI 192를 요구하며 다른 조건은 거부합니다.

```powershell
npm.cmd run test:native-service-audit
npm.cmd run experiment:native-services -- --trials=3 --functional
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

비교 명령은 한 Release bytecode package에서 TS control·snapshot input geometry·Path·clip/Paint·Scene composition·Semantics geometry를 각각 선택합니다. 각 mode의 fresh owner 3회에서 Gallery 두 열 → Mixed를 측정하고, `--functional`은 후보별 실제 키 입력·한글 IME·Gallery 복귀·정상 종료도 검사합니다. SDK 집계와 독립 C++ 작업 수, 입력 시간 안의 native QPC bucket을 대조합니다. 계수 비용이 포함된 비교이며 물리 입력·scanout 성능 수락은 별도입니다.

작업 수 0인 필수 입력 구간은 `FAIL_NO_NATIVE_WORK_IN_SOME_LEGS`로 남고 명령은 exit 2로 종료합니다. 다른 장면이나 startup의 작업으로 통과시키지 않습니다. App source는 자동 복구되지만 현재 Release 출력은 실험 package이므로 마지막 일반 실행 명령으로 재빌드하세요. 일반 App은 이 후보들을 기본 활성화하지 않습니다. 결과와 미채택 근거는 [work5.md](../../history/26/11/03/work5-summary.md)에 있습니다.

### All components 전체 예열·전체 구간 측정

Testbed 창을 닫고 자동 실행 중에는 물리 입력을 쉬게 둡니다. 후보 비교와 같은 최대화 client 2560×1459 / DPI 192 조건을 사용합니다.

```powershell
npm.cmd run test:gallery-full-range
npm.cmd run measure:windows-full-range -- --trials=3 --diagnostic-after
# N4 후보 비교: 입력 구간 안의 독립 QPC 작업 audit 포함
npm.cmd run experiment:native-services -- --full-range --modes=ts,backing --trials=3 --diagnostic-after
# N1/N2/N3 비교와 mode별 별도 Gallery/Mixed/IME 회귀
npm.cmd run experiment:native-services -- --full-range --modes=ts,layout,text,frame --trials=3 --diagnostic-after --functional
# cadence를 반복하지 않고 기능 회귀 owner만 실행
npm.cmd run experiment:native-services -- --full-range --modes=ts,layout,text,frame --functional-only
# 자동 입력·측정 없이 사용자가 직접 조작하며 coverage 관측
npm.cmd run run:windows:cpp -- --module=path --full-range
```

자동 실행의 fresh owner마다 양 열의 현재 catalog section을 겹치는 OS wheel 이동으로 전부 방문하고 layout, bundled font 등록, 이미지의 유효 첫 frame을 확인한 뒤 두 열을 최상단으로 되돌립니다. 예열은 최대 3회이며, 이후 각 열의 실제 top→bottom을 초당 약 1 viewport로 이동합니다. bounded section cache와 editor keep-alive 정책을 사용합니다. coverage 누락, 환경 변경, partial input, 원래 입력 시간 뒤의 bottom 도달은 실패입니다.

`GALLERY_RANGE_TRIAL`은 예열 coverage·extent·submitted geometry와 정확한 native surface trace의 간격·section별 통계를 보고합니다. 독립 surface counter와 trace 수도 대조합니다. `--diagnostic-after`는 CPU stage·paragraph cache·native producer timing을 수집하는 별도 owner를 선택 mode마다 1개 추가하며, 그 수치는 기준 3 owners cadence 요약에서 제외합니다. 자동 명령은 `finally`에서 일반 App 소스를 복구하고 현재 bytecode package를 다시 빌드합니다. 보고는 bounded RAM/stdout만 사용하며 surface 갱신을 물리 표시의 부드러움 수락으로 쓰지 않습니다.

`--functional`은 선택 mode마다 별도 owner에서 창 전환, Gallery 두 열, Mixed의 한글 IME·undo 편집, Gallery 복귀와 native drain을 검사합니다. `--functional-only`는 cadence 없이 이 회귀만 실행합니다. 두 명령 모두 종료 시 일반 App을 복구·재빌드합니다.

수동 모드에서는 **양쪽 열을 모두** 끝까지 방문→둘 다 top 복귀→각 열 top→bottom 순서로 확인합니다. `NATIVE_MODULE_RESULT.galleryRange`는 마지막 수동 coverage snapshot이며 자동 완료 gate·timing 판정은 실행하지 않습니다. `--full-range`는 coverage 관측, `--module`은 native 후보 선택입니다. 현재 결과와 후보 선택은 [work6.md](../../history/26/11/03/work6-summary.md)에 기록합니다.

### 개발 세션

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run dev -- --port 8081
```

Hermes Metro·네이티브 Debug 세션을 시작합니다. Metro만 실행하려면 `--launch false`를 추가하고, Ctrl+C로 종료합니다. V8·JSC·Static Hermes는 이 개발 refresh 경로를 지원하지 않습니다.

### 창 크기 변경 진단

Windows 준비·runner 재설치 후 저장소 루트에서 실행합니다. 실제 OS 마우스로 임시 검사 앱을 드래그하므로 실행 중에는 마우스·트랙패드 조작을 멈추세요.

```powershell
npm run test:windows-resize
```

Material·ListView·Cupertino의 양쪽 모서리를 검사하고, 요청/실제 입력 빈도, 창 rect 변화, surface 갱신과 캡처에서 관찰한 표시 변화를 각각 출력합니다. 기본 입력은 61Hz·4초 왕복이며 `NELYX_ANIMATION_DRAG_HZ`와 `NELYX_ANIMATION_DRAG_DURATION_MS`로 바꿀 수 있습니다. `NELYX_ANIMATION_PIXELS=0`은 캡처를 끈 CPU·geometry 비교에 사용합니다. 검사 통과는 화면·프레임 수명 조건의 통과이며 목표 FPS 달성을 뜻하지 않습니다. 캡처 실행의 비용과 실제 사용자의 드래그 체감은 별도로 평가해야 합니다. 검사 앱과 임시 빌드는 종료 시 정리됩니다.

기본 엔진 모드는 Hermes bytecode입니다. Static Hermes를 준비한 앱에서는 다음처럼 별도 PowerShell 프로세스에서 AOT fixture를 빌드·실행할 수 있습니다. 각 실행은 native 초기화와 실제 AOT 함수 호출도 확인합니다. 현재 제품 패키지를 교체하지 않으며, 두 모드의 성능은 따로 비교하세요.

```powershell
pwsh -NoProfile -Command {
    $runtime = Get-Content sample/nelyx-testbed-app-2/.nelyx/windows/static-hermes-inputs.json -Raw | ConvertFrom-Json
    $env:NELYX_STATIC_HERMES_INPUTS = $runtime.directory
    $env:NELYX_ANIMATION_HERMES_MODE = 'static-aot'
    npm.cmd run test:windows-resize
    exit $LASTEXITCODE
}
```

`NELYX_ANIMATION_TRACE=1`은 Core metrics 수신, 프레임 예약, layout·paint·semantics·capture와 native 제출을 같은 QPC 시계로 연결합니다. 전체 활성 프레임과 정확히 일치하는 native prepared-copy 프레임의 비용을 따로 보고하며, 계측을 끈 성능과 구분해야 합니다.

`NELYX_ANIMATION_RESIZE_PAGES=material`, `NELYX_ANIMATION_RESIZE_WIDTH=600`, `NELYX_ANIMATION_RESPONSIVE_SHORT_HEADER=1`을 함께 설정하면 short header의 breakpoint를 검사합니다. 18px 제목은 유지하고, 같은 desktop frame의 창 폭에 따라 padding 16↔28 전환의 예상 좌표를 검사합니다. 높이 600 logical px 이상에서 제목이 28↔36px로 바뀌는 경우는 이 프로필의 대상이 아닙니다.

### 렌더링 연속성 진단

같은 Windows 준비·runner 설치를 사용해 저장소 루트에서 실행합니다. 실제 OS 휠 입력을 사용하므로 실행 중에는 마우스·트랙패드 조작을 멈추세요.

```powershell
npm run test:windows-render-liveness
```

창 크기를 고정한 채 idle redraw 8회와 OS 스크롤 12묶음을 실행합니다. 요청마다 서로 다른 색의 실제 desktop pixel과 native 프레임 증가를 확인해, JS 상태만 바뀌고 화면이 멈추는 문제를 검사합니다. 이 명령은 Hermes bytecode 검사이며 Static Hermes의 성능이나 전체 scanout 수락을 대신하지 않습니다. 앱과 임시 빌드는 종료 시 정리됩니다.

현재 빌드된 Windows 패키지에서 연속 입력·닫기를 검사하려면 다음 명령을 사용합니다.

```powershell
npm run test:windows-continuous-scroll
```

Material·ListView·Cupertino에서 독립적으로 OS 휠을 연속 입력하며 본문 화면 변화의 간격을 측정합니다. 입력 직후 닫기를 요청하고 창 숨김·파괴, 프로세스 종료와 native drain을 따로 확인합니다. Material은 최대화·복원과 마우스 이동을 포함합니다. 실제 마우스·트랙패드는 검사 중 조작하지 마세요. 이 검사는 현재 패키지의 제한된 자동 입력이며 물리 트랙패드나 전체 표시 성능 수락을 대신하지 않습니다.

실제 사용 중 지연 구간을 콘솔에서 확인하려면 새 프로세스를 다음과 같이 실행합니다.

```powershell
$env:NELYX_WINDOWS_FRAME_DIAGNOSTICS='1'
try { npm run run:windows --workspace '@nelyx/testbed-2' }
finally { Remove-Item Env:NELYX_WINDOWS_FRAME_DIAGNOSTICS -ErrorAction SilentlyContinue }
```

100ms 이상 걸린 frame clock 대기, JS 프레임 예약·실행, native UI 큐·작업, GPU producer·retirement와 종료 단계를 구분해 출력합니다. 일반 실행에서는 출력하지 않으며 파일 로그를 만들지 않습니다. 닫기를 수락한 창은 먼저 숨겨지고, 실행 명령은 입력·GPU·RNW 정리가 끝난 뒤 반환됩니다.

실행한 터미널이나 도구 세션에 따라 증상이 달라지면, 별도 프로세스에서 현재 앱을 읽기 전용으로 관찰할 수 있습니다.

```powershell
$scrollApp = Get-Process NelyxRNHost | Select-Object -First 1
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id
# 재현 직후, 앱을 열어둔 채 읽기
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id -Read
# 관찰만 종료하고 앱은 유지
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id -Stop
```

관찰 프로세스는 Explorer를 통해 독립 실행됩니다. 최대 20분 동안 이 앱 위의 OS 휠 감지, 포커스·capture, UI 응답과 앱 영역의 desktop hash를 관찰하고 최근 약 102초(512개 표본)만 공유 메모리에 유지합니다. 키보드 내용·이미지·파일 로그는 저장하지 않습니다. 앱 종료 또는 시간 만료 시 hook·GDI·공유 메모리를 정리하며, 앱 종료 뒤에는 마지막 기록을 최대 2분 유지합니다. OS 휠 감지는 native 메시지·SDK·Core 수신을 증명하지 않으며 desktop hash는 FPS나 전체 표시 수락이 아닙니다. 트랙패드의 모든 DirectManipulation 입력을 포착하지는 않습니다.

스크롤 도중 짧게 화면이 멈추는 구간을 추적하려면, 현재 SDK와 native 진단이 포함된 패키지를 새 프로세스로 실행합니다.

```powershell
$env:NELYX_WINDOWS_INPUT_TRACE='1'
try { npm run run:windows --workspace '@nelyx/testbed-2' }
finally { Remove-Item Env:NELYX_WINDOWS_INPUT_TRACE -ErrorAction SilentlyContinue }
```

재현 직후 다른 터미널에서 앱을 열어둔 채 읽습니다. 화면 관찰에는 OS mouse hook을 설치하지 않는 `-NoHook` 모드를 함께 사용할 수 있습니다.

```powershell
$scrollApp = Get-Process NelyxRNHost | Select-Object -First 1
pwsh -NoProfile -File Nelyx/eng/windows-input-trace.ps1 -TargetProcessId $scrollApp.Id
# 전체 현재 표본이 필요하면 -Raw 추가
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId $scrollApp.Id -NoHook
```

native 진단은 32개 단계의 누계·최신값과 최대 8,192개 숫자 기록만 공유 메모리에 둡니다. 일반 갱신은 16회마다 표본화하며 상태 전환·거절·SDK/Core 입력 지연 200ms 이상·JS frame work 100ms 이상·단계 간격 250ms 이상은 보존합니다. console/file 출력·추가 프레임 요청·입력 hook은 없고 비활성 시 메모리를 할당하지 않습니다. `payload-written`은 native payload 작성, `sdk-received`는 실제 SDK 수신, `core-dispatch-end`는 controller 처리 종료를 뜻하며 handler 실패는 `core-drop` reason 4도 남깁니다. native packet sequence와 Core input counter는 별개이며 Core 관찰의 `input`과 `a`로 연결합니다. SDK의 세대/순서 거절과 Core의 hidden/viewport 거절도 구분합니다. `gaps`는 500ms 이상 단계 표본 간격입니다. `frameGaps`는 300ms 이상 제출 간격과 주변 제스처 시작·종료·취소를 함께 보여주며, `consecutiveSubmissions=true`인 경우만 실제 연속 제출 사이의 공백으로 확정합니다. 종료·취소 기록만으로 손을 뗐거나 정상 idle이었다고 판단하지 않습니다. 트랙패드는 활성 HWND 타이머로 렌더링과 독립해 갱신하며 애니메이션 요청은 DWM refresh deadline으로 예약합니다. 이 예약 tick은 화면 표시 완료를 뜻하지 않습니다. 프레임 제출·GPU 완료·surface update·retirement는 실제 표시 receipt가 아니므로 화면 관찰과 비교합니다. 앱을 닫으면 native 기록은 사라집니다.

짧은 구간의 모든 이벤트가 필요하면 실행 전 `NELYX_WINDOWS_INPUT_TRACE_FULL='1'`도 설정하고 실행 뒤 해제하세요. 같은 8,192개 ring의 오래된 이벤트를 덮어쓰므로 스크롤 직후 읽어야 합니다. `sampleEvery`는 이 모드에서 `1`, 기본 표본 모드에서 `16`입니다.

### 실험적인 직접 Hermes 호스트

현재 Windows 패키지를 공급하고 설치한 뒤 실행합니다.

```powershell
node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode
node Nelyx/eng/run-native-hermes.mjs --hermes-mode static-aot
```

같은 앱을 직접 HWND·Skia·TSF·UIA 호스트로 빌드하고 실행합니다. Windows x64, 대응하는 네이티브 입력, Visual Studio C++ 도구, LLVM, CMake와 Ninja가 필요합니다. 패키지는 이 앱의 `.nelyx/native-windows/current-bytecode/`·`current-static-aot/`에 있습니다. 기본 호스트는 RNW입니다. 외부 앱 명령은 [CLI 가이드](../../Nelyx/sdk/tooling/cli/README.ko.md#네이티브-준비-조건)를 참고하세요.

실제 두 열 Gallery의 CPU 비용은 제한된 RAM 기반 source-stage 진단 후 새 프로세스 3회로 측정합니다.

```powershell
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scroll-scenes --scope stages
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scroll-scenes --scope cpu --repeat 3
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scroll-scenes --scope gc
```

네 장면은 첫 진입, warm 이동, 버튼 hover, 포커스된 텍스트 편집을 구분합니다. 스크롤·hover는 framework에서 합성하며 직접 호스트 진단입니다. RNW·OS wheel·물리 트랙패드·IME·화면 표시 수락은 별도로 확인해야 합니다. 측정 중에는 데스크톱 입력을 멈추세요. `stages`만 RAM 계측을 켜고 `cpu`는 끕니다. `motion.intervals`는 정지·재접촉 사이 공백을 제외합니다. native replay는 동기 buffer copy·validation·recording을 합친 구간이며 GPU 시간이 아닙니다. 임시 진단 package는 성공·실패 시 제거하며 profile·검증 로그는 파일로 저장하지 않습니다.

`gc`는 별도로 실행해 Hermes 누적 할당·수집·pause 통계를 켭니다. 장면별 누적값 차이는 개별 frame 안의 pause 위치를 알려주지 않으며, 해당 타이밍을 `cpu` 기준값 대신 사용하지 않습니다.

**입력·버튼 스크롤** 페이지는 별도 명령으로 측정합니다. 하나의 Column과 12개 편집기를 처음부터 모두 유지하며 모든 장면에서 실제 스크롤 범위의 맨 위부터 맨 아래까지 왕복합니다. 첫 이동은 편도 4초이며 no-hover·버튼 hover·편집기 focus는 정지 후 편도 1.5초의 빠른 전체 왕복도 수행합니다. 실제 offset·target·extent·viewport를 보고하며 두 viewport보다 짧으면 실패합니다. 이전 96px 왕복과 직접 비교하지 않습니다.

`stages`의 `Native.recording*`와 `slowNativeRecordings`는 같은 frame의 native recorder lock 대기, Graphite snap 벽시계 시간, Windows 현재 스레드 CPU 시간, snap 이후 wrapping·slot 처리를 구분합니다. 스레드 CPU는 OS 집계 해상도의 제한을 받으며 미지원 값은 `null`입니다. 다른 스레드의 CPU와 프로세스 전체 CPU를 나타내지 않습니다. GPU 실행 시간이나 특정 driver/fence 원인을 확정하는 값이 아닙니다. 최신 native 공급본이 필요하며 일반 실행과 `cpu`에서는 이 추가 계측을 호출하지 않습니다.

```powershell
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --mixed-scroll-scenes --scope stages
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --mixed-scroll-scenes --scope cpu
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --mixed-scroll-scenes --scope sampling
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --viewport maximized --mixed-scroll-pixels --scope cpu
```

이 명령에도 위의 직접 호스트·합성 입력 진단 범위와 데스크톱 입력 중지 조건이 적용됩니다. `sampling`은 네 장면의 상위 Hermes 함수를 조사하며 가중치는 CPU ms가 아닙니다. 성능은 별도 `--scope cpu --repeat 3`으로 비교합니다. `--mixed-scroll-pixels`는 실제 페이지의 세 버튼을 위·아래 경계에 걸쳐 native GPU 픽셀로 비교하는 별도 검사이며 성능 측정이 아닙니다. 세 옵션 `--scroll-scenes`, `--mixed-scroll-scenes`, `--mixed-scroll-pixels`는 서로 함께 사용하지 않습니다.

실제 RNW 경로의 source 단계와 native 제출·producer 완료·surface 갱신·retirement를 같은 owner/viewport/context/surface/frame/input 식별로 연결하려면 다음 진단을 사용합니다.

```powershell
node Nelyx/eng/run-rnw-frame-probe.mjs
```

기존 Windows runner의 SDK를 갱신하고 임시 probe를 넣어 Hermes bytecode / optimized / Release로 빌드·실행합니다. 열린 앱에서 장면을 조작하고 정상 종료하면 `App.tsx`와 임시 소스는 finally에서 원복됩니다. 취소·실패 때도 자신이 만든 fixture만 정리하며, 실행 중 앱 소스가 외부에서 바뀌면 덮어쓰지 않습니다. 로그 파일은 만들지 않고 bounded RAM 표본과 느린 frame 상세를 stdout으로 냅니다. 이 진단의 wrapper·timer·native thread 관찰 비용을 일반 `cpu` 결과와 비교하지 않습니다. callback wall은 owned View callback 범위이며 native dispatch/poll과 이후 JS checkpoint는 제외합니다. 설치 전에 예약된 callback wall은 미관찰이고, 한 frame에 기여한 여러 callback의 시간도 합산하지 않습니다. Native input counter는 마지막 Core 입력 표식이며 개별 wheel의 offset 변경·표시 완료 증거가 아닙니다. 다음 일반 `run:windows`는 원복된 소스를 다시 빌드해 probe 없는 제품을 실행합니다.

callback의 작업은 wet layout·measurement query·text layout·Element rebuild·sliver child 생성으로도 나눕니다. 범주는 서로 겹치며, `total`은 같은 범주의 중첩만 제외합니다. 상위 constructor 이름은 축약되거나 충돌할 수 있어 개별 class 식별로 사용하지 않습니다. 마지막 종료 보고·native 실패 수·binding close·shutdown acknowledgement를 검사하며, 개별 GC pause와 GPU 독립 실행 시간·scanout은 관찰하지 않습니다.

## Android

표준 OpenJDK **21**, Android SDK·build tools **36**, NDK **27.1.12297006**, Vulkan을 지원하는 x86_64 에뮬레이터와 대응하는 Android Skia 공급 파일이 필요합니다. 빌드 전에 `JAVA_HOME`을 사용할 JDK로 설정하세요. Android runner의 package.json이 참조하는 네이티브 공급 archive가 설치 전에 있어야 하며, `prepare:sample`은 Nelyx 패키지를 공급합니다.

```powershell
npm.cmd run prepare:sample -- android
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner install --ignore-scripts --workspaces=false
Push-Location sample/nelyx-testbed-app-2/android/runner
try {
    npx.cmd --no-install nelyx build --app ../.. --target android --architecture x86_64 --configuration Release
    adb devices -l
    npx.cmd --no-install nelyx run --app ../.. --target android --device emulator-5554
} finally {
    Pop-Location
}
```

`emulator-5554`를 `adb devices -l`의 실제 serial로 바꾸세요. Runner가 Release APK를 설치하고 실행합니다. 샘플은 x86_64를 요구하는 `emulator-vulkan` profile을 선택합니다. ARM64 물리 기기에는 호환 profile과 네이티브 입력도 필요합니다. 대상별 상세 내용은 [Android runner](android/runner/README.md)에 있습니다.

## 앱 둘러보기

| 화면 | 사용해 볼 기능 |
| --- | --- |
| Material 3 | 카테고리, 버튼, 선택 컨트롤, 밝은·어두운 테마와 seed 색상 |
| Cupertino | Cupertino 컴포넌트, 강조색, dialog와 Material 복귀 |
| Text inputs | 한글·emoji 입력, Clear·Undo, 보안 입력, 선택, 줄 수와 내부 스크롤 |
| Forms | 이름·이메일 검증, Next·Done, 저장과 초기화 |
| Navigation | 경로 열기, 카운터 변경과 결과 반환 |
| ListView | 1,000행에서 선택, 처음·마지막 이동과 선택 해제 |

갤러리는 데모를 `ready`·`basic`·`planned`로 표시합니다. **준비 중 포함**으로 계획된 항목을 볼 수 있습니다. 테마와 메시지는 디자인 화면 전환 후에도 유지하고, ListView는 다시 열 때 선택·스크롤 위치를 초기화합니다.

## 앱 설정

루트 [package.json](package.json)의 `nelyx`에 공통 진입점, 자산과 대상별 profile을 선언합니다. 각 runner가 플랫폼 컴포넌트를 등록합니다. 자산·대상을 추가할 때는 [SDK 가이드](../../Nelyx/sdk/README.ko.md#설정과-provider)를 따르세요.

## 문제 해결

| 증상 | 조치 |
| --- | --- |
| CanvasKit 런타임 누락·불일치 | 런타임 빌드·공급 후 Web 준비 반복 |
| 로컬 패키지·소스 불일치 | SDK 재빌드, 대상별 공급과 runner 재설치 |
| 네이티브 컴파일 소스 불일치 | 대응하는 렌더러 공급 파일을 재빌드하고 새 manifest로 준비 |
| Windows 패키지 교체 실패 | 해당 패키지에서 실행 중인 앱 종료 |
| Android JDK image·jlink 실패 | `JAVA_HOME`이 표준 OpenJDK 21을 가리키는지 확인 |
| 다른 Android 기기 선택됨 | `--device`로 정확한 `adb` serial 지정 |

실험적인 앱이며 전체 디자인 기능, 그래픽 복구, 물리 입력·IME, 스크린 리더, 성능과 제품 서명에는 추가 검증이 필요합니다. 직접 호스트와 대체 엔진도 실험적 선택지입니다.

## 라이선스와 자산

갤러리는 DorotiTestbedApp의 Components 페이지를 참고합니다. Flutter 출처 고지는 [LICENSE.flutter](LICENSE.flutter)에 있습니다. [자산](assets/)에는 Noto Sans KR, Material Icons, Cupertino Icons와 Mae Mu / Unsplash 이미지가 포함되며, 배포 시 해당 고지를 유지해야 합니다.
